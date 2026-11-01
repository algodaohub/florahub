/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pnlvhbonsg171u2")

  const addText = (id, name, max) => collection.schema.addField(new SchemaField({
    "system": false,
    "id": id,
    "name": name,
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": max, "pattern": "" }
  }))

  // Mã vùng 2 cấp (tỉnh/phường) admin chọn khi sửa địa chỉ đơn hàng,
  // khác với mã Goship 3 cấp lưu ở shipping_city_code/shipping_ward_code_goship.
  addText("shpregc", "shipping_region_city_code", 20)
  addText("shpregw", "shipping_region_ward_code", 20)

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pnlvhbonsg171u2")

  for (const id of ["shpregc", "shpregw"]) {
    collection.schema.removeField(id)
  }

  return dao.saveCollection(collection)
})
