/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "sqhioxk8c1xwspb",
    "created": "2026-10-26 02:49:29.339Z",
    "updated": "2026-10-26 02:49:29.339Z",
    "name": "probe_date",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "pgdjj23j",
        "name": "d",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": "",
          "max": ""
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
  const collection = dao.findCollectionByNameOrId("sqhioxk8c1xwspb");

  return dao.deleteCollection(collection);
})
