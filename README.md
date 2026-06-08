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

| Tool | Description |
|---|---|
| `tracetool_send` | Send a debug / warning / error message |
| `tracetool_send_value` | Expandable object tree |
| `tracetool_send_xml` | XML with syntax highlighting |
| `tracetool_send_table` | Multi-column table |
| `tracetool_clear_all` | Clear the viewer |
| `tracetool_set_host` | Change viewer host at runtime |
| `tracetool_get_config` | Current host + environment flags |

## Usage examples

Just ask Claude naturally:

- *"Send a debug trace: processing started"*
- *"Log this object to TraceTool"* (and paste a JSON)
- *"Clear the viewer and trace the login flow"*
