/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "pnwxhvtrgti7n8l",
    "created": "2026-10-26 02:54:40.304Z",
    "updated": "2026-10-26 02:54:40.304Z",
    "name": "flash_sale_items",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "48kekkkq",
        "name": "sale_price",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "noDecimal": true
        }
      },
      {
        "system": false,
        "id": "yelsk7bc",
        "name": "quantity_limit",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "noDecimal": true
        }
      },
      {
        "system": false,
        "id": "uxmr0ck4",
        "name": "legacy_id",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      }
    ],
    "indexes": [],
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("pnwxhvtrgti7n8l");

  return dao.deleteCollection(collection);
})
