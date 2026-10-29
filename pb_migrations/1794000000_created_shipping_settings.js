/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const textField = (id, name, max) => ({
    "system": false,
    "id": id,
    "name": name,
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": max,
      "pattern": ""
    }
  })

  const numberField = (id, name, min, max) => ({
    "system": false,
    "id": id,
    "name": name,
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": min,
      "max": max,
      "noDecimal": true
    }
  })

  const boolField = (id, name) => ({
    "system": false,
    "id": id,
    "name": name,
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  })

  const collection = new Collection({
    "id": "shpsettings0001",
    "created": "2026-10-29 00:00:00.000Z",
    "updated": "2026-10-29 00:00:00.000Z",
    "name": "shipping_settings",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "shpscope",
        "name": "scope",
        "type": "text",
        "required": true,
        "presentable": true,
        "unique": true,
        "options": {
          "min": null,
          "max": 40,
          "pattern": ""
        }
      },
      boolField("shpenabl", "enabled"),
      textField("shptoken", "goship_access_token", 1000),
      textField("shpclid1", "goship_client_id", 300),
      textField("shpclsec", "goship_client_secret", 300),
      textField("shpbase1", "goship_api_base_url", 300),
      textField("shpwid01", "goship_webhook_id", 100),
      textField("shpwurl1", "goship_webhook_url", 300),
      textField("shppname", "pickup_name", 120),
      textField("shpphone", "pickup_phone", 40),
      textField("shpstret", "pickup_street", 300),
      textField("shpward1", "pickup_ward", 120),
      textField("shpdist1", "pickup_district", 120),
      textField("shpcity1", "pickup_city", 120),
      textField("shpwdc01", "pickup_ward_code", 40),
      textField("shpdtc01", "pickup_district_code", 40),
      textField("shpctc01", "pickup_city_code", 40),
      numberField("shpdwt01", "default_weight", 0, null),
      numberField("shpditw1", "default_item_weight", 0, null),
      numberField("shppkgw1", "packaging_weight", 0, null),
      numberField("shpdlen1", "default_length", 0, 200),
      numberField("shpdwid1", "default_width", 0, 200),
      numberField("shpdhei1", "default_height", 0, 200),
      boolField("shpcod01", "cod_enabled"),
      boolField("shpauto1", "auto_advance"),
      numberField("shpttl01", "quote_ttl_seconds", 30, 3600),
      numberField("shpcache", "rate_cache_seconds", 0, 3600),
      numberField("shprlmt1", "quote_rate_limit_per_minute", 1, 600),
      {
        "system": false,
        "id": "shpfall1",
        "name": "address_fallback",
        "type": "select",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": ["flat", "ask_district", "block"]
        }
      },
      textField("shpverif", "last_verified_at", 40)
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("shpsettings0001");

  return dao.deleteCollection(collection);
})
