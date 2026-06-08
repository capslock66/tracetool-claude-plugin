# TraceTool — Claude Code Plugin

Send structured traces to the [TraceTool](https://github.com/capslock66/Tracetool) viewer directly from Claude Code.

## Prerequisites

- **TraceTool viewer** installed and running on Windows (default port 81 for HTTP)
- **Node.js** installed

## Installation

in claude cli:

```bash
/plugin marketplace add capslock66/tracetool-claude-plugin
/plugin install tracetool@tracetool-plugins
/reload-plugins
```
Then check if the Mcp server is running
```bash
/mcp
```

Of course you need to install tracetool itself,
see https://github.com/capslock66/tracetool

## Configuration

The viewer host defaults to `127.0.0.1:81`. Override it via the plugin config or at runtime:

```json
{
  "pluginConfigs": {
    "tracetool@<marketplace>": {
      "mcpServers": {
        "tracetool": {
          "env": { "TRACETOOL_HOST": "127.0.0.1:815" }
        }
      }
    }
  }
}
```

Or call the tool directly:
> "set tracetool host to 127.0.0.1:81"

## Available tools

### Send new traces

| Tool | Description |
|---|---|
| `tracetool_send` | Send a debug / warning / error message |
| `tracetool_send_value` | Expandable object tree |
| `tracetool_send_xml` | XML with syntax highlighting |
| `tracetool_send_table` | Multi-column table |
| `tracetool_send_object` | Object with class info, fields and methods |
| `tracetool_send_stack` | Current call stack |
| `tracetool_send_dump` | Hex dump of a buffer |

### Modify existing nodes (require `node` JSON string)

| Tool | Description |
|---|---|
| `tracetool_resend` | Override left and/or right message |
| `tracetool_resend_left` | Override the left column message |
| `tracetool_resend_right` | Override the right column message |
| `tracetool_resend_icon_index` | Change the icon index |
| `tracetool_set_background_color` | Change background color of a node |
| `tracetool_append` | Append text to left and/or right column |
| `tracetool_append_left` | Append text to the left column |
| `tracetool_append_right` | Append text to the right column |
| `tracetool_show` | Scroll a node into view |
| `tracetool_set_selected` | Select a node in the viewer |
| `tracetool_delete_it` | Delete a node |
| `tracetool_delete_children` | Delete all children of a node |
| `tracetool_set_bookmark` | Set or clear the bookmark flag |
| `tracetool_set_font_detail` | Change font details for a column or whole line |

### Viewer management

| Tool | Description |
|---|---|
| `tracetool_show_viewer` | Show or hide the viewer window |
| `tracetool_clear_all` | Clear the viewer |
| `tracetool_set_host` | Change viewer host at runtime |
| `tracetool_get_config` | Current host + environment flags |

## Usage examples

Just ask Claude naturally:

- *"Send a debug trace: processing started"*
- *"Log this object to TraceTool"* (and paste a JSON)
- *"Clear the viewer and trace the login flow"*
- *"Send the call stack to TraceTool"*
- *"Update that last trace to show the elapsed time on the right"*
- *"Bookmark that node"*
- *"highlight that node in yellow"*
