/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("shpsettings0001");

  // Token Goship (JWT) có thể vượt 1000 ký tự; nới cột để không chặn cấu hình hợp lệ.
  collection.schema.getFieldByName("goship_access_token").options.max = 4000;
  collection.schema.getFieldByName("goship_client_id").options.max = 500;
  collection.schema.getFieldByName("goship_client_secret").options.max = 1000;

  return dao.saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("shpsettings0001");

  collection.schema.getFieldByName("goship_access_token").options.max = 1000;
  collection.schema.getFieldByName("goship_client_id").options.max = 300;
  collection.schema.getFieldByName("goship_client_secret").options.max = 300;

  return dao.saveCollection(collection);
})
