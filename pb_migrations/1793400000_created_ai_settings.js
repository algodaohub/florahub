/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "aisettings000001",
    "created": "2026-10-28 09:00:00.000Z",
    "updated": "2026-10-28 09:00:00.000Z",
    "name": "ai_settings",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "aiprovider00001",
        "name": "provider",
        "type": "select",
        "required": true,
        "presentable": true,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": ["9router", "openai", "anthropic", "custom"]
        }
      },
      {
        "system": false,
        "id": "aibaseurl000001",
        "name": "base_url",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 300,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "aiapikey0000001",
        "name": "api_key",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 500,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "aimodel00000001",
        "name": "model",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 160,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "aimodels0000001",
        "name": "models",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 20000
        }
      }
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
  const collection = dao.findCollectionByNameOrId("aisettings000001");

  return dao.deleteCollection(collection);
})
