/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "kzruf8ra00ww2iw",
    "created": "2026-10-26 02:48:14.464Z",
    "updated": "2026-10-26 02:48:14.464Z",
    "name": "probe_tmp",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "fc5tdfov",
        "name": "title",
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
  const collection = dao.findCollectionByNameOrId("kzruf8ra00ww2iw");

  return dao.deleteCollection(collection);
})
