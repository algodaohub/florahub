/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "oryplty1mbf3fjt",
    "created": "2026-10-26 06:20:24.866Z",
    "updated": "2026-10-26 06:20:24.866Z",
    "name": "tmp_json_test",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "zio7xafb",
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
      },
      {
        "system": false,
        "id": "zysvushl",
        "name": "payload",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
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
  const collection = dao.findCollectionByNameOrId("oryplty1mbf3fjt");

  return dao.deleteCollection(collection);
})
