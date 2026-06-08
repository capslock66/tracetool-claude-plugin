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
All these tools can have a first optional `parentNode` or `node` parameter (default null) that specifies the parent node under which the message will be added. If `parentNode` is null, the message will be added at the root level. use a true null, not a string "null". For example:
```tracetool_send(parentNode=null, level="debug", message="Hello from Claude")
```

## Available tools

### Send new traces (parentNode optional — null = root level)

| Tool | Purpose |
|---|---|
| `tracetool_send` | Send a debug / warning / error message (1 or 2 columns) |
| `tracetool_send_value` | Send a JSON-serialisable value as an expandable tree |
| `tracetool_send_xml` | Send XML with syntax highlighting |
| `tracetool_send_table` | Send an array of objects as a table |
| `tracetool_send_object` | Send an object with class info, fields and methods |
| `tracetool_send_stack` | Send the current call stack |
| `tracetool_send_dump` | Send a hex dump of a buffer |

### Modify existing nodes (node parameter is mandatory JSON string)

| Tool | Purpose |
|---|---|
| `tracetool_resend` | Override left and/or right message of an existing node |
| `tracetool_resend_left` | Override the left column message |
| `tracetool_resend_right` | Override the right column message |
| `tracetool_resend_icon_index` | Change the icon of a node |
| `tracetool_set_background_color` | Change the background color of a node |
| `tracetool_append` | Append text to left and/or right column |
| `tracetool_append_left` | Append text to the left column |
| `tracetool_append_right` | Append text to the right column |
| `tracetool_show` | Force a node to be scrolled into view |
| `tracetool_set_selected` | Select a node in the viewer |
| `tracetool_delete_it` | Delete a node |
| `tracetool_delete_children` | Delete all children of a node |
| `tracetool_set_bookmark` | Set or clear the bookmark flag |
| `tracetool_set_font_detail` | Change font (bold/italic/color/size/name) for a column or whole line |

### Viewer management

| Tool | Purpose |
|---|---|
| `tracetool_show_viewer` | Show or hide the TraceTool viewer window |
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

### Send an object
```
tracetool_send_object(parentNode=null, level="debug", message="My object", obj='{"x":1,"y":2}', displayFunctions=false)
```

### Send a call stack
```
tracetool_send_stack(parentNode=null, level="debug", message="Where am I?")
```

### Send a hex dump
```
tracetool_send_dump(parentNode=null, level="debug", message="Buffer", shortTitle="raw", buffer="Hello", count=5)
```

### Modify an existing node
```
var nodeStr = tracetool_send(parentNode=null, level="debug", message="Processing...")
tracetool_resend_right(node=nodeStr, rightMsg="done in 42 ms")
tracetool_set_background_color(node=nodeStr, color="#00FF00", colId=-1)
tracetool_set_font_detail(node=nodeStr, colId=3, bold=true, italic=false, color="#FF0000", size=0, fontName="")
tracetool_append_left(node=nodeStr, leftMsg=" [extra info]")
tracetool_set_bookmark(node=nodeStr, bookmarked=true)
```

### Delete nodes
```
tracetool_delete_children(node=parentNodeStr)
tracetool_delete_it(node=nodeStr)
```

## Rules
1. parentNode should be passed as a JSON string returned from a previous call, or null for root-level messages.
2. For node-modification tools (`tracetool_resend*`, `tracetool_append*`, `tracetool_show`, `tracetool_set_*`, `tracetool_delete_*`), the `node` parameter is **mandatory** and must be the JSON string returned by a previous send call.
3. Use `level="error"` only for actual errors; `level="warning"` for non-fatal issues.
4. Pass `value` to `tracetool_send_value` as a **JSON string** (call `JSON.stringify` mentally).
5. Pass `rows` to `tracetool_send_table` as a **JSON array string**.
6. Colors are specified as `#RRGGBB` or `RGB(r,g,b)`. Named colors are not supported.
