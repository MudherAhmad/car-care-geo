# Geoapify MCP Setup and Agent Workflow

This tutorial shows how to connect an MCP-compatible AI client to the Geoapify MCP Server and verify geospatial tool use safely.

> The deterministic Smart Dispatch ranking in this repository uses the Geoapify Route Matrix API directly. MCP is demonstrated separately as an agent-side geospatial workflow and does not own Car Care business decisions.

## Architecture role

Geoapify MCP can provide an AI agent with geospatial tools for tasks such as:

- geocoding and reverse geocoding
- route calculation
- Route Matrix exploration
- place and geometry operations

The Car Care application remains responsible for:

- driver eligibility and availability
- booking conflicts
- customer and booking state
- permissions
- final assignment or mutation

## Prerequisites

- an MCP-compatible client that supports remote HTTP / Streamable HTTP
- a Geoapify API key
- a protected way to provide the API key
- synthetic or non-sensitive coordinates for the public walkthrough

## Geoapify MCP endpoint

```text
https://api.geoapify.com/v1/mcp
```

Prefer a protected `x-api-key` header or environment-variable-backed secret. Never commit the real API key to this repository.

## VS Code with GitHub Copilot

Create or update `.vscode/mcp.json` without placing the real Geoapify API key in the file.

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "geoapify-api-key",
      "description": "Geoapify API key",
      "password": true
    }
  ],
  "servers": {
    "geoapify": {
      "type": "http",
      "url": "https://api.geoapify.com/v1/mcp",
      "headers": {
        "x-api-key": "${input:geoapify-api-key}"
      }
    }
  }
}
```

Start the `geoapify` server from the VS Code MCP configuration interface.

VS Code prompts for the API key as a password input, so the credential does not need to be stored in the project file.

Before accepting an AI-generated MCP configuration, verify that the real API key is not present in `.vscode/mcp.json`.

## Cursor

Set `GEOAPIFY_API_KEY` in the environment that starts Cursor.

Then create or update `.cursor/mcp.json` and preserve any existing MCP servers:

```json
{
  "mcpServers": {
    "geoapify": {
      "url": "https://api.geoapify.com/v1/mcp",
      "headers": {
        "x-api-key": "${env:GEOAPIFY_API_KEY}"
      }
    }
  }
}
```

Restart Cursor after changing its environment.

Open Cursor MCP settings and enable `geoapify`.

Confirm that `.cursor/mcp.json` contains only the environment-variable reference and never the real API key.

## Verification prompts

After the MCP server is connected, use prompts that explicitly require Geoapify tool results instead of model memory.

### 1. Geocode a public location

```text
Use the Geoapify geocode_address tool to geocode Växjö, Sweden. Return only the resolved place name, latitude and longitude from the tool result.
```

Expected tool: `geocode_address`.

### 2. Reverse geocode coordinates

```text
Use the Geoapify reverse_geocode_coordinates tool for latitude 56.8790 and longitude 14.8059. Return the nearby location information from the tool result and do not infer missing fields.
```

Expected tool: `reverse_geocode_coordinates`.

### 3. Calculate one driving route

```text
Use the Geoapify calculate_route tool to calculate a driving route from latitude 56.8790, longitude 14.8059 to latitude 56.8660, longitude 14.8170. Return the tool-provided driving distance and travel time. Do not estimate them yourself.
```

Expected tool: `calculate_route`.

### 4. Compare eligible drivers with Route Matrix

This example starts after the application has already determined which drivers are eligible.

```text
Use the Geoapify calculate_route_matrix tool.

Treat these three synthetic locations as already-eligible driver sources:
- driver-a: latitude 56.8700, longitude 14.7900
- driver-b: latitude 56.8850, longitude 14.8200
- driver-c: latitude 56.8600, longitude 14.8350

Use one pickup target at latitude 56.8790, longitude 14.8059.

Use drive mode, balanced routing, approximated traffic and metric units.

Compare only tool-returned travel times and distances.
Rank usable drivers by lowest driving ETA, then lowest driving distance.
If a matrix cell is unavailable, do not invent a route for that driver.
Return the recommended driver ID and the tool-provided ETA and distance.
Do not assign a driver and do not make any booking or business-state mutation.
```

Expected tool: `calculate_route_matrix`.

Expected behavior:

- Geoapify supplies travel-time and road-distance evidence.
- the agent compares only usable matrix cells
- unavailable cells are not guessed or repaired by the model
- the result is a recommendation, not an assignment
- business eligibility remains outside the MCP tool

This mirrors the spatial question demonstrated by Smart Dispatch while keeping the production architecture explicit: the public application uses the direct Route Matrix API for deterministic ranking, while MCP is a separate agent-side demonstration.

## Privacy and safety boundaries

- Never place a real Geoapify API key in a committed file, screenshot, exported settings or public log.
- Prefer a protected `x-api-key` header or environment-variable-backed secret.
- Treat any MCP URL containing an `apiKey` query parameter as a credential.
- Use synthetic or non-sensitive coordinates in public examples.
- Do not send production customer addresses or other private booking data to an AI client unless the surrounding application explicitly permits that data flow.
- MCP tool results are spatial evidence. They do not grant booking, payment, membership or driver-assignment authority.

## Failure behavior

The AI client must not invent Geoapify results when a tool call fails or returns incomplete spatial evidence.

For the Smart Dispatch example:

- an unavailable matrix cell is excluded from ranking
- a completely unavailable matrix produces no spatial recommendation
- MCP failure must not create or mutate a driver assignment
- business decisions remain with the Car Care application

## Limitations

- MCP availability depends on the AI client supporting remote HTTP or Streamable HTTP connections.
- Geoapify MCP requires an API key and does not use OAuth as a replacement for that key.
- Route Matrix returns travel-time and distance evidence, not detailed route geometry or turn-by-turn instructions.
- Use `calculate_route` when a detailed ordered route is required.
- The public MCP examples are synthetic demonstrations and are not a production booking or dispatch interface.
- The production Smart Dispatch ranking remains implemented through the direct Geoapify Route Matrix API, not through this MCP tutorial.

## Reproducibility checklist

1. Connect the Geoapify MCP endpoint with a protected API key.
2. Confirm the client can discover Geoapify tools.
3. Run one geocoding or reverse-geocoding prompt.
4. Run the single-route prompt.
5. Run the Route Matrix Smart Dispatch prompt.
6. Confirm unavailable tool evidence is not guessed.
7. Confirm no prompt performs booking or driver-assignment mutation.
