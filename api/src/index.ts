import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import compression from "compression";
import {
  buildSchema,
  execute,
  parse,
  specifiedRules,
  subscribe,
  validate,
  type DocumentNode,
  type ExecutionResult,
  type GraphQLError,
  type GraphQLSchema,
} from "graphql";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { createLoaders } from "./loaders.js";
import { pool } from "./db.js";
import { pubsub } from "./pubsub.js";
import { startLedgerEventListener } from "./pg-listener.js";
import { depthLimit } from "./depthLimit.js";
import { getClientIp } from "./clientIp.js";
import {
  MemoryRateLimitStore,
  PostgresRateLimitStore,
  checkRateLimit,
  rateLimitHeaders,
  type RateLimitStore,
} from "./rateLimit.js";

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

const isProduction = process.env.NODE_ENV === "production";
const schema = buildSchema(typeDefs);

// Issue #210: attach a `subscribe` resolver to the Subscription type's
// field(s). `buildSchema` only builds types from SDL with default field
// resolvers, so the async-iterator-producing resolver has to be wired in
// after the fact — there's no separate resolver map for subscriptions the
// way there is for Query/Mutation's rootValue.
const subscriptionType = schema.getSubscriptionType();
if (subscriptionType) {
  const ledgerAddedField = subscriptionType.getFields().ledgerAdded;
  ledgerAddedField.subscribe = () => pubsub.subscribe("LEDGER_ADDED");
  ledgerAddedField.resolve = (payload) => payload;
}

const validationRules = [...specifiedRules, depthLimit()];

function validateWithLimits(schema: GraphQLSchema, document: DocumentNode) {
  return validate(schema, document, validationRules);
}

async function runQuery(
  source: string,
  variableValues?: Record<string, unknown>,
): Promise<ExecutionResult> {
  let document: DocumentNode;
  try {
    document = parse(source);
  } catch (err) {
    return { errors: [err as GraphQLError] };
  }
  const errors = validateWithLimits(schema, document);
  if (errors.length > 0) return { errors };
  return execute({
    schema,
    document,
    rootValue: resolvers,
    contextValue: { loaders: createLoaders() },
    variableValues,
  }) as Promise<ExecutionResult>;
}

// Issue #420: RATE_LIMIT_STORE=postgres shares counters across replicas;
// the in-memory store remains the default and the fallback on DB errors.
const memoryRateLimitStore = new MemoryRateLimitStore();
const sharedRateLimitStore: RateLimitStore | null =
  process.env.RATE_LIMIT_STORE === "postgres" ? new PostgresRateLimitStore(pool) : null;

setInterval(() => {
  memoryRateLimitStore.prune();
  if (sharedRateLimitStore instanceof PostgresRateLimitStore) {
    sharedRateLimitStore.prune().catch((err) => console.error("[api] rate limit prune failed", err));
  }
}, 60000).unref();

const playgroundHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>GraphQL Playground</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; color: #0f172a; border-top: 4px solid #3b82f6; }
      textarea { width: 100%; min-height: 250px; font-family: monospace; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
      pre { background: #f8fafc; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0; overflow-x: auto; min-height: 200px; }
      button { margin-top: 0.75rem; padding: 0.6rem 1.2rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
      button:hover { background: #2563eb; }
      .container { max-width: 900px; margin: 0 auto; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Stellar Analytics GraphQL Explorer</h1>
      <p>Test queries against the real-time Stellar indexer.</p>
      
      <div class="grid">
        <div>
          <h3>Query</h3>
          <textarea id="query">query Example {
  networkStats {
    tps
    totalAccounts
    activeAccounts24h
  }
  ledgers(limit: 5) {
    edges {
      node {
        sequence
        transactionCount
        closeTime
      }
    }
  }
}</textarea>
          <br />
          <button id="run">Execute Query</button>
        </div>
        <div>
          <h3>Result</h3>
          <pre id="result">{}</pre>
        </div>
      </div>
    </div>
    <script>
      document.getElementById("run").addEventListener("click", async () => {
        const query = document.getElementById("query").value;
        const resultEl = document.getElementById("result");
        resultEl.textContent = "Loading...";
        
        try {
          const response = await fetch("/graphql", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ query })
          });
          const json = await response.json();
          resultEl.textContent = JSON.stringify(json, null, 2);
        } catch (err) {
          resultEl.textContent = "Error: " + err.message;
        }
      });
    </script>
  </body>
</html>
`;

app.use("/graphql", async (req, res, next) => {
  const ip = getClientIp(req.headers["x-forwarded-for"], req.socket.remoteAddress);
  let result;
  try {
    result = await checkRateLimit(sharedRateLimitStore ?? memoryRateLimitStore, ip);
  } catch (err) {
    console.error("[api] shared rate limit store unavailable, using memory store", err);
    result = await checkRateLimit(memoryRateLimitStore, ip);
  }
  res.set(rateLimitHeaders(result));
  if (!result.allowed) {
    res.status(429).json({ error: "Too many requests from this IP, please try again later." });
    return;
  }
  next();
});

app.get("/graphql", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query : null;
  if (!query) {
    if (isProduction) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).type("html").send(playgroundHtml);
    return;
  }

  const result = await runQuery(query);
  res.status(200).json(result);
});

app.post("/graphql", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const variables =
    typeof req.body?.variables === "object" && req.body.variables ? req.body.variables : undefined;

  const result = await runQuery(query, variables);
  res.status(200).json(result);
});

const port = Number(process.env.PORT ?? 4000);

// Use a plain http.Server (rather than app.listen) so the WebSocket
// subscription transport can share the same port via an HTTP upgrade.
const httpServer = createServer(app);

const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});
useServer({ schema, execute, subscribe, validate: validateWithLimits }, wsServer);

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/stellar_analytics";
startLedgerEventListener(connectionString).catch((err) => {
  console.error("[api] failed to start ledger event listener", err);
});

httpServer.listen(port, () => {
  console.log(`[api] GraphQL server ready at http://localhost:${port}/graphql`);
  console.log(`[api] GraphQL subscriptions ready at ws://localhost:${port}/graphql`);
});
