---
name: tracetool
description: >
  Send structured traces to the TraceTool viewer using the MCP tools exposed by
  the tracetool plugin. Use when the user asks to log, trace, debug, or send
  messages to the TraceTool viewer. Also use when the user asks to clear the viewer,
  inspect an object, or show indented method entry/exit traces.
---

# TraceTool Skill

You have access to a set of `tracetool_*` MCP tools that send structured messages
to the **TraceTool viewer** (a Windows desktop trace viewer).  
The viewer must be running before any tool call will succeed.

## Note
All tools that send messages (`tracetool_send`, `tracetool_send_value`, `tracetool_send_xml`, etc.) return a json object that can be used to create child nodes or to update the message later with `tracetool_send_child`.

## Available tools

| Tool | Purpose |
|---|---|
| `tracetool_send` | Send a debug / warning / error message (1 or 2 columns) |
| `tracetool_send_value` | Send a JSON-serialisable value as an expandable tree |
| `tracetool_send_xml` | Send XML with syntax highlighting |
| `tracetool_send_table` | Send an array of objects as a table |
| `tracetool_clear_all` | Clear all traces in the main viewer window |
| `tracetool_set_host` | Change the viewer host (default `127.0.0.1:81`) |
| `tracetool_get_config` | Return the current host and environment flags |


## How to use

### Simple message
```
tracetool_send(parentNode=null, level="debug", message="Hello from Claude")
```

### Two-column trace (left | right)
```
tracetool_send(parentNode=null, level="warning", message="Response time", right="450 ms")
```
### Parent trace with indented children
```
var parentNodeString = tracetool_send(parentNode=null, level="debug", message="Main trace")
var parentNode = JSON.parse(parentNodeString)
var childNodeString = tracetool_send(parentNode=parentNode, level="debug", message="Child trace")
```

### Inspect an object
```
tracetool_send_value(parentNode=null,level="debug", message="Response", value='{"status":200,"body":"ok"}', maxLevel=3)
```

### Send an XML payload
```
tracetool_send_xml(parentNode=null, level="debug", message="SOAP request", xml="<root><item>1</item></root>")
```

### Send a table
```
tracetool_send_table(parentNode=null, level="debug", message="Users", rows='[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]')
```

## Configuration

- Default host: `127.0.0.1:81`
- Override at runtime: `tracetool_set_host(host="127.0.0.1:81")`
- Override via env variable: set `TRACETOOL_HOST` in the plugin config

## Rules
1. parentNode should be passed as a JSON string returned from a previous call, or null for root-level messages.
2. Use `level="error"` only for actual errors; `level="warning"` for non-fatal issues.
3. Pass `value` to `tracetool_send_value` as a **JSON string** (call `JSON.stringify` mentally).
4. Pass `rows` to `tracetool_send_table` as a **JSON array string**.
