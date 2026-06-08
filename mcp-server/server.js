#!/usr/bin/env node
// TraceTool MCP Server — Claude Code Plugin
// Exposes TraceTool viewer tracing as MCP tools.
// The TraceTool viewer must be running before sending traces.

"use strict";

const path = require("path");
const fs   = require("fs");

// ---------------------------------------------------------------------------
// Auto-install dependencies on first run (plugin may not have run npm install)
// ---------------------------------------------------------------------------
const nodeModules = path.join(__dirname, "node_modules");
if (!fs.existsSync(nodeModules)) {
  process.stderr.write("[tracetool] Installing dependencies...\n");
  const { execSync } = require("child_process");
  execSync("npm install --omit=dev", { cwd: __dirname, stdio: "inherit" });
  process.stderr.write("[tracetool] Dependencies installed.\n");
}

// ---------------------------------------------------------------------------
// Redirect console.log → stderr  (stdout is reserved for MCP JSON-RPC)
// ---------------------------------------------------------------------------
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

const { McpServer }          = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z }                  = require("zod");

// Local copy of tracetool.js — modify freely if needed
const ttrace = require("./tracetool.js");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
ttrace.host = process.env.TRACETOOL_HOST || "127.0.0.1:81";

//process.stderr.write(`[tracetool] MCP server starting. Viewer host: ${ttrace.host}\n`);

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "tracetool",
  version: "15.0.0",
});

// -----------------------------------------------------------------------
// Tool: send
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send",
  "Send a trace message to the TraceTool viewer. Returns the serialized node. If parentNode is provided, the message is attached as a child of that node.",
  {
    parentNode: z.string().optional().describe("JSON string of a previously returned node. If provided, the message is sent as a child of that node."),
    level:      z.enum(["debug", "warning", "error"]).default("debug").describe("Trace level"),
    message:    z.string().describe("Main (left column) message text"),
    right:      z.string().optional().describe("Optional right-column message"),
  },
  async ({ parentNode,level, message, right }) => {
    let sender;
    if (parentNode) {
      var parentNodeObject = JSON.parse(parentNode);
      sender = new ttrace.classes.TraceNode(null, false);
      sender.id = parentNodeObject.id;
    } else {
      sender = ttrace[level];
    }
    var node = sender.send(message, right);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: send_value
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send_value",
  "Send a JavaScript object/value to the TraceTool viewer as an expandable tree. If parentNode is non-null, the value is attached as a child of that node.",
  {
    parentNode: z.string().nullable().describe("JSON string of a previously returned node, or null to send at root level."),
    level:      z.enum(["debug", "warning", "error"]).default("debug"),
    message:    z.string().describe("Label for the value"),
    value:      z.string().describe("JSON-encoded value to inspect (will be parsed)"),
    maxLevel:   z.number().int().min(1).max(10).default(3).describe("Max tree depth"),
  },
  async ({ parentNode, level, message, value, maxLevel }) => {
    let sender;
    if (parentNode) {
      sender = new ttrace.classes.TraceNode(null, false);
      sender.id = JSON.parse(parentNode).id;
    } else {
      sender = ttrace[level];
    }
    let parsed;
    try { parsed = JSON.parse(value); } catch { parsed = value; }
    var node = sender.sendValue(message, parsed, maxLevel);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: send_xml
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send_xml",
  "Send an XML string to the TraceTool viewer with syntax highlighting. If parentNode is non-null, the XML is attached as a child of that node.",
  {
    parentNode: z.string().nullable().describe("JSON string of a previously returned node, or null to send at root level."),
    level:      z.enum(["debug", "warning", "error"]).default("debug"),
    message:    z.string().describe("Label for the XML trace"),
    xml:        z.string().describe("XML text to display"),
  },
  async ({ parentNode, level, message, xml }) => {
    let sender;
    if (parentNode) {
      sender = new ttrace.classes.TraceNode(null, false);
      sender.id = JSON.parse(parentNode).id;
    } else {
      sender = ttrace[level];
    }
    var node = sender.sendXml(message, xml);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: send_table
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send_table",
  "Send a table (array of objects) to the TraceTool viewer. If parentNode is non-null, the table is attached as a child of that node.",
  {
    parentNode: z.string().nullable().describe("JSON string of a previously returned node, or null to send at root level."),
    level:      z.enum(["debug", "warning", "error"]).default("debug"),
    message:    z.string().describe("Label for the table"),
    rows:       z.string().describe("JSON array of row objects, e.g. [{col1:'a', col2:1}, ...]"),
  },
  async ({ parentNode, level, message, rows }) => {
    let sender;
    if (parentNode) {
      sender = new ttrace.classes.TraceNode(null, false);
      sender.id = JSON.parse(parentNode).id;
    } else {
      sender = ttrace[level];
    }
    let parsed;
    try { parsed = JSON.parse(rows); }
    catch { return { content: [{ type: "text", text: "Error: rows must be a valid JSON array." }] }; }
    var node = sender.sendTable(message, parsed);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: clear_all
// -----------------------------------------------------------------------
server.tool(
  "tracetool_clear_all",
  "Clear all traces in the main TraceTool viewer window.",
  {},
  async () => {
    ttrace.clearAll();
    return { content: [{ type: "text", text: "TraceTool viewer cleared." }] };
  }
);

// -----------------------------------------------------------------------
// Tool: set_host
// -----------------------------------------------------------------------
server.tool(
  "tracetool_set_host",
  "Set the TraceTool viewer host (e.g. '127.0.0.1:81'). Call this before other tools if the viewer runs on a different port.",
  { host: z.string().describe("host:port of the TraceTool viewer") },
  async ({ host }) => {
    ttrace.host = host;
    return { content: [{ type: "text", text: JSON.stringify({ host }) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: get_config
// -----------------------------------------------------------------------
server.tool(
  "tracetool_get_config",
  "Return the current TraceTool runtime configuration: viewer host and the environment detection flags from tracetool.js (isChromeExtension, isBrowser, isNodeJs, isRequireJs, isCommonJS, isSystemJS).",
  {},
  async () => {
    const config = { host: ttrace.host };
    for (const pair of ttrace.environment.split(",")) {
      const [key, val] = pair.split(":");
      config[key.trim()] = val.trim() === "true";
    }
    return { content: [{ type: "text", text: JSON.stringify(config, null, 2) }] };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  //process.stderr.write("[tracetool] MCP server ready.\n");
}

main().catch((err) => {
  process.stderr.write(`[tracetool] Fatal: ${err.message}\n`);
  process.exit(1);
});
