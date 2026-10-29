/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hodszshy1vujjze")

  collection.indexes = [
    "CREATE UNIQUE INDEX `idx_affiliates_code` ON `affiliates` (`code`)",
    "CREATE UNIQUE INDEX `idx_affiliates_user` ON `affiliates` (`user`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hodszshy1vujjze")

  collection.indexes = []

  return dao.saveCollection(collection)
})
