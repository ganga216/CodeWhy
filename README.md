# CodeWhy — Why The Code Is Like This

**A runnable hackathon prototype for evidence-first engineering decision archaeology.** It lets a developer ask why a behavior exists, inspect a relationship graph, follow an answer to source records, see earlier decisions marked as superseded, and receive an explicit refusal when there is not enough evidence.

> **Prototype boundary:** the initial workspace uses clearly labelled illustrative sample data. Connecting a public GitHub repository replaces that sample with live GitHub metadata. The current implementation uses transparent heuristics for decision candidates and keyword-based evidence retrieval. Neo4j AuraDB persistence and LLM-based GraphRAG are not connected in this build; they are called out as the next integration layer rather than simulated as if they were live.

## Run it

Requirements: **Node.js 18+**. No npm packages are required for the default local demo.

### Windows

1. Extract the ZIP.
2. Open the extracted `why-code-prototype` folder in PowerShell or Command Prompt.
3. Run:

   ```powershell
   npm start
   ```

4. Open **http://localhost:8787** in your browser.
5. Select **Connect repository** and enter a public GitHub URL, for example `https://github.com/fastapi/fastapi`.

### macOS / Linux

```bash
cd why-code-prototype
npm start
```

Then open `http://localhost:8787`.

Stop the server with `Ctrl+C`.

### If dashboard buttons do not respond

Use the fixed build in this ZIP. The graph renderer previously referenced an undeclared `focusNode`, which could stop startup before click handlers were registered. The current build declares the focused node and wires persistent controls before the initial render. If port `8787` is already in use, first open `http://localhost:8787`; if an old server is running, stop that terminal with `Ctrl+C` before restarting.

## Demo flow for hackathon judges

1. Start on the preloaded **Ask why** view. The main question is already filled in: “Why is the retry limit set to three?”
2. Review the answer, decision record, confidence signal, and evidence chain.
3. Click a node in the graph to inspect its metadata and connected sources.
4. Use the question chips to explore the auth-migration and cache-invalidation examples.
5. Select **Try an unanswerable question** to demonstrate the evidence-threshold refusal.
6. Open **Decision timeline** to see older and newer decisions together, or **People & owners** to inspect contributor nodes.
7. Select **Connect repository** to index a real public GitHub project. The live graph is built from the public GitHub API and replaces the illustrative sample in server memory.

## What is implemented

- Responsive dark UI with animated graph links, pulsing status indicators, loading states, focus/expand graph controls, modals, and keyboard shortcut `/` to focus the query.
- Interactive graph nodes for decisions, code entities, commits, issues, pull requests, incidents, contributors, and documents.
- Seeded evidence chains that explicitly identify themselves as illustrative demo content.
- Public GitHub ingestion for repository metadata, recent commits, a bounded issue / pull-request history, selected commit file paths, a few README / architecture-style documents, and discussion comments.
- Heuristic candidate decision extraction with source links retained.
- Conservative supersession candidates when newer records contain explicit replacement / revert / deprecation signals and sufficient lexical overlap.
- Evidence-based query scoring with a minimum evidence threshold; low-scoring queries are refused rather than answered with an invented rationale.
- A simple JSON API for the front end (`/api/health`, `/api/graph`, `/api/ask`, `/api/ingest`).

## Important accuracy notes

- The default sample workspace `acme/payments-platform` is fictional. Names, contributors, incidents, pull requests, dates, paths, and rationales in the starter graph are **illustrative**; they are not factual claims about a public repository.
- Live ingestion reads a bounded sample of a repository's public GitHub history. It is not yet a complete historical crawl and may miss old or deeply nested discussions.
- Keyword overlap and heuristics are useful for a prototype but cannot reliably determine human intent by themselves. Treat extracted decision candidates and supersession flags as suggestions for review.
- GitHub may rate-limit unauthenticated API calls. If an ingest fails, the UI displays the error and the demo graph remains usable.
- The graph currently lives in server memory. Restarting the server resets it to the sample graph.
- The interface does not claim to be using Neo4j AuraDB or an LLM when it is not.

## Suggested next step: Neo4j AuraDB + GraphRAG

For a production-grade build aligned with the brief, use Neo4j AuraDB as the persistence layer and preserve the evidence trail as graph relationships. Recommended core node labels are `Repository`, `CodeEntity`, `Decision`, `Commit`, `PullRequest`, `Issue`, `Incident`, `Person`, and `Document`. Recommended relationships include `TOUCHES`, `DISCUSSED_IN`, `AUTHORED_BY`, `MOTIVATED_BY`, `DOCUMENTED_IN`, `GOVERNS`, `SUPERSEDES`, and `RELATED_TO`.

A grounded GraphRAG answering flow should:

1. Resolve code entities and decision candidates using graph traversal plus semantic retrieval.
2. Retrieve the supporting source records and their timestamps, authors, and URLs.
3. Check outgoing `SUPERSEDES` links and compare decision dates before composing an answer.
4. Ask the language model to answer **only from retrieved evidence**, with citations to exact source records.
5. Return “insufficient evidence” when the required chain cannot be assembled, and separate confirmed relationships from heuristic candidates.

## Project structure

```text
why-code-prototype/
├── server.js             # local HTTP server + public GitHub ingestion + question API
├── package.json          # zero-dependency default start command
├── README.md
└── public/
    ├── index.html        # application interface
    ├── styles.css        # responsive styles and motion
    └── app.js            # graph renderer, navigation, query and modal interactions
```

## API overview

- `GET /api/health` — health and graph counts.
- `GET /api/graph` — current repository metadata and graph.
- `POST /api/ask` — body: `{ "question": "Why is the retry limit set to three?" }`.
- `POST /api/ingest` — body: `{ "repoUrl": "https://github.com/owner/repository" }`.

No credentials are required for the sample workspace. Live ingestion uses public endpoints only.
