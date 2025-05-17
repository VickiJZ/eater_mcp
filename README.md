# resy_mcp
mcp for booking workflow on resy

## Usage
Start the MCP server and call the `resy_search` tool with the desired parameters.

### Parameters
- `city` – slug for the desired city (e.g. `new-york-ny`)
- `seat_number` – number of seats to request
- `date` – reservation date in `YYYY-MM-DD` format
- `time` – reservation time in `HHMM` format
- `cuisine` – cuisine facet to filter by
- `restaurant_names` – optional array of restaurant names to query individually
- `query_keyword` – optional keyword if `restaurant_names` is not provided

### Example

```json
{
  "city": "new-york-ny",
  "seat_number": 2,
  "date": "2025-05-21",
  "time": "1900",
  "cuisine": "Italian",
  "restaurant_names": ["Restaurant A", "Restaurant B"]
}
```

If `restaurant_names` is omitted, the server will fall back to `query_keyword` to perform a single search.
