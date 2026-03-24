import express from "express";
import cors from "cors";
import { buildSchema, graphql } from "graphql";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers/index.js";

const app = express();
app.use(cors());
app.use(express.json());

const schema = buildSchema(typeDefs);
const rootValue = {
  health: resolvers.health,
  ledgers: resolvers.ledgers
};

const playgroundHtml = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>GraphQL Playground</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; color: #0f172a; }
      textarea { width: 100%; min-height: 160px; }
      pre { background: #f8fafc; padding: 1rem; border-radius: 8px; }
      button { margin-top: 0.75rem; padding: 0.5rem 1rem; }
    </style>
  </head>
  <body>
    <h1>GraphQL Playground</h1>
    <p>Run a query against <code>/graphql</code>.</p>
    <textarea id="query">{ health { status timestamp } }</textarea>
    <br />
    <button id="run">Run Query</button>
    <pre id="result"></pre>
    <script>
      document.getElementById("run").addEventListener("click", async () => {
        const query = document.getElementById("query").value;
        const response = await fetch("/graphql", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query })
        });
        const json = await response.json();
        document.getElementById("result").textContent = JSON.stringify(json, null, 2);
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

  const result = await graphql({ schema, source: query, rootValue });
  res.status(200).json(result);
});

app.post("/graphql", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const variables =
    typeof req.body?.variables === "object" && req.body.variables ? req.body.variables : undefined;

  const result = await graphql({
    schema,
    source: query,
    rootValue,
    variableValues: variables
  });
  res.status(200).json(result);
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`[api] GraphQL server ready at http://localhost:${port}/graphql`);
});
