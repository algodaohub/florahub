/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "storecfg0000001",
    "created": "2026-10-26 12:00:00.000Z",
    "updated": "2026-10-26 12:00:00.000Z",
    "name": "store_configs",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "scname000000001",
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": true,
        "unique": false,
        "options": {
          "min": null,
          "max": 80,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "scdomain0000001",
        "name": "domain",
        "type": "text",
        "required": false,
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
        "id": "scpreset0000001",
        "name": "preset",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 60,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "scactive0000001",
        "name": "active",
        "type": "bool",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "system": false,
        "id": "scdefault0000001",
        "name": "is_default",
        "type": "bool",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "system": false,
        "id": "scconfig0000001",
        "name": "config",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      }
    ],
    "indexes": [
      "CREATE INDEX `idx_store_configs_domain` ON `store_configs` (`domain`)"
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  Dao(db).saveCollection(collection);

  const saved = Dao(db).findCollectionByNameOrId("store_configs");
  const record = new Record(saved, {
    "name": "FloraHub",
    "domain": "",
    "preset": "vuon-nha",
    "active": true,
    "is_default": true,
    "config": {
      "brand": {
        "name": "FloraHub",
        "tagline": "Hoa tươi mỗi ngày",
        "description": "Cửa hàng hoa tươi giao nhanh, giá minh bạch, đặt hoa trực tuyến mỗi ngày.",
        "logoUrl": "/images/logo.svg",
        "faviconUrl": "/images/logo.svg",
        "hotline": "1900 0000",
        "email": "hello@florahub.vn",
        "address": "TP. Hồ Chí Minh"
      },
      "seo": {
        "description": "Cửa hàng hoa tươi giao nhanh, giá minh bạch, đặt hoa trực tuyến mỗi ngày.",
        "keywords": "hoa tươi, hoa hồng, giỏ hoa, quà tặng"
      },
      "content": {
        "hero": {
          "eyebrow": "FloraHub",
          "title": "Hoa tươi mỗi ngày",
          "subtitle": "Chọn bó hoa hợp gu, giao tận cửa trong ngày."
        }
      }
    }
  });

  Dao(db).saveRecord(record);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("storecfg0000001");

  return dao.deleteCollection(collection);
})
