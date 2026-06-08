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
// Helper: reconstruct a TraceNode from a JSON string returned by a previous tool
// -----------------------------------------------------------------------
function nodeFromJson(nodeJson) {
  const obj = JSON.parse(nodeJson);
  const node = new ttrace.classes.TraceNode(null, false);
  node.id = obj.id;
  node.winTraceId = obj.winTraceId || '';
  return node;
}

// -----------------------------------------------------------------------
// Tool: send_object
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send_object",
  "Send an object (class info, fields, methods) to the TraceTool viewer. If parentNode is provided, the object is attached as a child of that node.",
  {
    parentNode:        z.string().nullable().describe("JSON string of a previously returned node, or null to send at root level."),
    level:             z.enum(["debug", "warning", "error"]).default("debug"),
    message:           z.string().describe("Label for the object"),
    obj:               z.string().describe("JSON-encoded object to inspect (will be parsed)"),
    displayFunctions:  z.boolean().optional().describe("Whether to include functions in the object inspection"),
  },
  async ({ parentNode, level, message, obj, displayFunctions }) => {
    let sender;
    if (parentNode) {
      sender = nodeFromJson(parentNode);
    } else {
      sender = ttrace[level];
    }
    let parsed;
    try { parsed = JSON.parse(obj); } catch { parsed = obj; }
    const node = sender.sendObject(message, parsed, displayFunctions);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: send_stack
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send_stack",
  "Send the current call stack to the TraceTool viewer. If parentNode is provided, the stack is attached as a child of that node.",
  {
    parentNode: z.string().nullable().describe("JSON string of a previously returned node, or null to send at root level."),
    level:      z.enum(["debug", "warning", "error"]).default("debug"),
    message:    z.string().describe("Label for the stack trace"),
    skipLevel:  z.number().int().min(0).default(0).optional().describe("Number of stack frames to skip"),
  },
  async ({ parentNode, level, message, skipLevel }) => {
    let sender;
    if (parentNode) {
      sender = nodeFromJson(parentNode);
    } else {
      sender = ttrace[level];
    }
    const node = sender.sendStack(message, skipLevel);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: send_dump
// -----------------------------------------------------------------------
server.tool(
  "tracetool_send_dump",
  "Send a hex dump of a buffer to the TraceTool viewer. If parentNode is provided, the dump is attached as a child of that node.",
  {
    parentNode:  z.string().nullable().describe("JSON string of a previously returned node, or null to send at root level."),
    level:       z.enum(["debug", "warning", "error"]).default("debug"),
    message:     z.string().describe("Label for the dump"),
    shortTitle:  z.string().describe("Short title displayed on top of the dump"),
    buffer:      z.string().describe("The buffer content to dump"),
    count:       z.number().int().optional().describe("Number of bytes to dump"),
  },
  async ({ parentNode, level, message, shortTitle, buffer, count }) => {
    let sender;
    if (parentNode) {
      sender = nodeFromJson(parentNode);
    } else {
      sender = ttrace[level];
    }
    const node = sender.sendDump(message, shortTitle, buffer, count);
    return { content: [{ type: "text", text: JSON.stringify(node) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: resend
// -----------------------------------------------------------------------
server.tool(
  "tracetool_resend",
  "Override the left and/or right message of an existing node in the TraceTool viewer.",
  {
    node:        z.string().describe("JSON string of the node to update (returned by a previous send call)."),
    leftMsg:     z.string().optional().describe("New left column message"),
    rightMsg:    z.string().optional().describe("New right column message"),
  },
  async ({ node, leftMsg, rightMsg }) => {
    const n = nodeFromJson(node);
    n.resend(leftMsg, rightMsg);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: resend_left
// -----------------------------------------------------------------------
server.tool(
  "tracetool_resend_left",
  "Override the left column message of an existing node in the TraceTool viewer.",
  {
    node:    z.string().describe("JSON string of the node to update."),
    leftMsg: z.string().describe("New left column message"),
  },
  async ({ node, leftMsg }) => {
    const n = nodeFromJson(node);
    n.resendLeft(leftMsg);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: resend_right
// -----------------------------------------------------------------------
server.tool(
  "tracetool_resend_right",
  "Override the right column message of an existing node in the TraceTool viewer.",
  {
    node:     z.string().describe("JSON string of the node to update."),
    rightMsg: z.string().describe("New right column message"),
  },
  async ({ node, rightMsg }) => {
    const n = nodeFromJson(node);
    n.resendRight(rightMsg);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: resend_icon_index
// -----------------------------------------------------------------------
server.tool(
  "tracetool_resend_icon_index",
  "Change the icon of an existing node in the TraceTool viewer.",
  {
    node:  z.string().describe("JSON string of the node to update."),
    index: z.number().int().describe("Icon index to set"),
  },
  async ({ node, index }) => {
    const n = nodeFromJson(node);
    n.resendIconIndex(index);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: set_background_color
// -----------------------------------------------------------------------
server.tool(
  "tracetool_set_background_color",
  "Change the background color of an existing node in the TraceTool viewer.",
  {
    node:  z.string().describe("JSON string of the node to update."),
    color: z.string().describe("Color as #RRGGBB or RGB(r,g,b)"),
    colId: z.number().int().default(-1).describe("Column index: all=-1, Icon=0, Time=1, Thread=2, Left=3, Right=4"),
  },
  async ({ node, color, colId }) => {
    const n = nodeFromJson(node);
    n.setBackgroundColor(color, colId);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: append
// -----------------------------------------------------------------------
server.tool(
  "tracetool_append",
  "Append text to the left and/or right column of an existing node in the TraceTool viewer.",
  {
    node:     z.string().describe("JSON string of the node to update."),
    leftMsg:  z.string().optional().describe("Text to append to the left column"),
    rightMsg: z.string().optional().describe("Text to append to the right column"),
  },
  async ({ node, leftMsg, rightMsg }) => {
    const n = nodeFromJson(node);
    n.append(leftMsg, rightMsg);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: append_left
// -----------------------------------------------------------------------
server.tool(
  "tracetool_append_left",
  "Append text to the left column of an existing node in the TraceTool viewer.",
  {
    node:    z.string().describe("JSON string of the node to update."),
    leftMsg: z.string().describe("Text to append to the left column"),
  },
  async ({ node, leftMsg }) => {
    const n = nodeFromJson(node);
    n.appendLeft(leftMsg);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: append_right
// -----------------------------------------------------------------------
server.tool(
  "tracetool_append_right",
  "Append text to the right column of an existing node in the TraceTool viewer.",
  {
    node:     z.string().describe("JSON string of the node to update."),
    rightMsg: z.string().describe("Text to append to the right column"),
  },
  async ({ node, rightMsg }) => {
    const n = nodeFromJson(node);
    n.appendRight(rightMsg);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: show
// -----------------------------------------------------------------------
server.tool(
  "tracetool_show",
  "Force a node to be displayed (scrolled into view) in the TraceTool viewer.",
  {
    node: z.string().describe("JSON string of the node to show."),
  },
  async ({ node }) => {
    const n = nodeFromJson(node);
    n.show();
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: set_selected
// -----------------------------------------------------------------------
server.tool(
  "tracetool_set_selected",
  "Set a node as selected in the TraceTool viewer.",
  {
    node: z.string().describe("JSON string of the node to select."),
  },
  async ({ node }) => {
    const n = nodeFromJson(node);
    n.setSelected();
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: delete_it
// -----------------------------------------------------------------------
server.tool(
  "tracetool_delete_it",
  "Delete a node from the TraceTool viewer.",
  {
    node: z.string().describe("JSON string of the node to delete."),
  },
  async ({ node }) => {
    const n = nodeFromJson(node);
    n.deleteIt();
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: delete_children
// -----------------------------------------------------------------------
server.tool(
  "tracetool_delete_children",
  "Delete all children of a node in the TraceTool viewer.",
  {
    node: z.string().describe("JSON string of the node whose children will be deleted."),
  },
  async ({ node }) => {
    const n = nodeFromJson(node);
    n.deleteChildren();
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: set_bookmark
// -----------------------------------------------------------------------
server.tool(
  "tracetool_set_bookmark",
  "Set or clear the bookmark flag of a node in the TraceTool viewer.",
  {
    node:       z.string().describe("JSON string of the node to bookmark."),
    bookmarked: z.boolean().describe("true to set bookmark, false to clear it"),
  },
  async ({ node, bookmarked }) => {
    const n = nodeFromJson(node);
    n.setBookmark(bookmarked);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: set_font_detail
// -----------------------------------------------------------------------
server.tool(
  "tracetool_set_font_detail",
  "Change font details (bold, italic, color, size, name) for a column or a whole line of an existing node.",
  {
    node:      z.string().describe("JSON string of the node to update."),
    colId:     z.number().int().default(-1).describe("Column index: whole line=-1, Icon=0, Time=1, Thread=2, Left=3, Right=4"),
    bold:      z.boolean().default(true).describe("Bold font"),
    italic:    z.boolean().default(false).describe("Italic font"),
    color:     z.string().default("").describe("Font color as #RRGGBB or RGB(r,g,b)"),
    size:      z.number().int().default(0).describe("Font size (0 = keep default)"),
    fontName:  z.string().default("").describe("Font name (empty = keep default)"),
  },
  async ({ node, colId, bold, italic, color, size, fontName }) => {
    const n = nodeFromJson(node);
    n.setFontDetail(colId, bold, italic, color, size, fontName);
    return { content: [{ type: "text", text: JSON.stringify(n) }] };
  }
);

// -----------------------------------------------------------------------
// Tool: show_viewer
// -----------------------------------------------------------------------
server.tool(
  "tracetool_show_viewer",
  "Show or hide the TraceTool viewer window.",
  { isVisible: z.boolean().default(true).describe("true to show the viewer, false to hide it") },
  async ({ isVisible }) => {
    ttrace.show(isVisible);
    return { content: [{ type: "text", text: JSON.stringify({ isVisible }) }] };
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
