/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "shpquotes000001",
    "created": "2026-10-29 00:20:00.000Z",
    "updated": "2026-10-29 00:20:00.000Z",
    "name": "shipping_quotes",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "shpqcart",
        "name": "cart_id",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqchsh",
        "name": "cart_hash",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 64, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqsesh",
        "name": "session_hash",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 64, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqafrm",
        "name": "address_from",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "maxSize": 200000 }
      },
      {
        "system": false,
        "id": "shpqato1",
        "name": "address_to",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "maxSize": 200000 }
      },
      {
        "system": false,
        "id": "shpqprcl",
        "name": "parcel",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "maxSize": 200000 }
      },
      {
        "system": false,
        "id": "shpqopts",
        "name": "options",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "maxSize": 500000 }
      },
      {
        "system": false,
        "id": "shpqfshp",
        "name": "free_shipping_applied",
        "type": "bool",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "system": false,
        "id": "shpqfsth",
        "name": "free_shipping_threshold",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": 0, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "shpqselo",
        "name": "selected_option_id",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqpay1",
        "name": "payment_method",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 20, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqcod1",
        "name": "cod_amount",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": 0, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "shpqmode",
        "name": "mode",
        "type": "select",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": ["live", "fallback", "none"]
        }
      },
      {
        "system": false,
        "id": "shpqstat",
        "name": "status",
        "type": "select",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": ["active", "used", "expired"]
        }
      },
      {
        "system": false,
        "id": "shpqord1",
        "name": "order",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "pnlvhbonsg171u2",
          "cascadeDelete": false,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": null
        }
      },
      {
        "system": false,
        "id": "shpqexp1",
        "name": "expires_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqcret",
        "name": "created_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqused",
        "name": "used_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "shpqfall",
        "name": "fallback_reason",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 200, "pattern": "" }
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_shipping_quotes_session` ON `shipping_quotes` (`session_hash`, `status`, `expires_at`)",
      "CREATE INDEX `idx_shipping_quotes_cart` ON `shipping_quotes` (`cart_id`)"
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
  const collection = dao.findCollectionByNameOrId("shpquotes000001");

  return dao.deleteCollection(collection);
})
