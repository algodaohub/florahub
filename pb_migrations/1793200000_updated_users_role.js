/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_")

  collection.schema.addField(
    new SchemaField({
      system: false,
      id: "usersrole0000001",
      name: "role",
      type: "select",
      required: false,
      presentable: false,
      unique: false,
      options: {
        maxSelect: 1,
        values: ["customer", "staff", "admin"]
      }
    })
  )

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("_pb_users_auth_")

  collection.schema.removeField("usersrole0000001")

  return dao.saveCollection(collection)
})
