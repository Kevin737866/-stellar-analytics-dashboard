import express from "express";
import cors from "cors";
import { buildSchema, graphql } from "graphql";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";
import { createLoaders } from "./loaders.js";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const schema = buildSchema(typeDefs);

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

app.get("/graphql", async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query : null;
  if (!query) {
    res.status(200).type("html").send(playgroundHtml);
    return;
  }

  const loaders = createLoaders();
  const result = await graphql({ 
    schema, 
    source: query, 
    rootValue: resolvers,
    contextValue: { loaders }
  });
  res.status(200).json(result);
});

app.post("/graphql", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const variables =
    typeof req.body?.variables === "object" && req.body.variables ? req.body.variables : undefined;

  const loaders = createLoaders();
  const result = await graphql({
    schema,
    source: query,
    rootValue: resolvers,
    contextValue: { loaders },
    variableValues: variables
  });
  res.status(200).json(result);
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[api] GraphQL server ready at http://localhost:${port}/graphql`);
});
