/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const products = dao.findCollectionByNameOrId("products")
  products.schema.addField(
    new SchemaField({
      system: false,
      id: "pf0000000000019",
      name: "geo_service_areas",
      type: "text",
      required: false,
      presentable: false,
      unique: false,
      options: { min: null, max: 500, pattern: "" }
    })
  )
  return dao.saveCollection(products)
}, (db) => {
  const dao = new Dao(db)
  const products = dao.findCollectionByNameOrId("products")
  products.schema.removeField("pf0000000000019")
  return dao.saveCollection(products)
})
