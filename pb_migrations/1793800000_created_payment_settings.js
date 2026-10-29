/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "paymentsetting1",
    "created": "2026-10-28 12:00:00.000Z",
    "updated": "2026-10-28 12:00:00.000Z",
    "name": "payment_settings",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "paymentscope001",
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
      {
        "system": false,
        "id": "sepayapitoken01",
        "name": "sepay_api_token",
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
        "id": "sepayapibase001",
        "name": "sepay_api_base_url",
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
        "id": "sepaywhapikey01",
        "name": "sepay_webhook_api_key",
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
        "id": "sepaywhsecret01",
        "name": "sepay_webhook_secret",
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
        "id": "sepaypgmerch001",
        "name": "sepay_pg_merchant_id",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 120,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "sepaypgsecret01",
        "name": "sepay_pg_secret_key",
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
        "id": "sepaypgipnsec01",
        "name": "sepay_pg_ipn_secret",
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
        "id": "sepaypgenv00001",
        "name": "sepay_pg_env",
        "type": "select",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSelect": 1,
          "values": ["sandbox", "production"]
        }
      },
      {
        "system": false,
        "id": "sepaypgpublic01",
        "name": "sepay_pg_public_url",
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
        "id": "sepaybankacct01",
        "name": "bank_accounts",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 200000
        }
      },
      {
        "system": false,
        "id": "sepaybanksync01",
        "name": "bank_accounts_synced_at",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 40,
          "pattern": ""
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
  const collection = dao.findCollectionByNameOrId("paymentsetting1");

  return dao.deleteCollection(collection);
})
