/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "shpevents000001",
    "created": "2026-10-29 00:10:00.000Z",
    "updated": "2026-10-29 00:10:00.000Z",
    "name": "shipment_events",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "shpeord1",
        "name": "order",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "pnlvhbonsg171u2",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": null
        }
      },
      {
        "system": false,
        "id": "shpeprov",
        "name": "provider",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 30, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpecode",
        "name": "code",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 60, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpestat",
        "name": "status_code",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": 0, "max": 2000, "noDecimal": true }
      },
      {
        "system": false,
        "id": "shpestxt",
        "name": "status_text",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 200, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpemsg1",
        "name": "message",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 500, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpetime",
        "name": "event_time",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shperaw1",
        "name": "raw",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "maxSize": 200000 }
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_shipment_events_order` ON `shipment_events` (`order`, `code`)",
      "CREATE INDEX `idx_shipment_events_time` ON `shipment_events` (`event_time`)"
    ],
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
  const collection = dao.findCollectionByNameOrId("shpevents000001");

  return dao.deleteCollection(collection);
})
