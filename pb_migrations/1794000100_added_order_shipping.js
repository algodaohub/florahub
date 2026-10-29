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

  const addNumber = (id, name, min, max) => collection.schema.addField(new SchemaField({
    "system": false,
    "id": id,
    "name": name,
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": min, "max": max, "noDecimal": true }
  }))

  const addBool = (id, name) => collection.schema.addField(new SchemaField({
    "system": false,
    "id": id,
    "name": name,
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  addText("shpprov1", "shipping_provider", 30)
  addText("shpquot1", "shipping_quote_id", 40)
  addText("shpopt01", "shipping_option_id", 40)
  addText("shpcar01", "shipping_carrier", 60)
  addText("shpcarnm", "shipping_carrier_name", 120)
  addText("shpsvc01", "shipping_service", 60)
  addText("shprate1", "shipping_rate_id", 120)
  addText("shpship1", "shipping_shipment_id", 120)
  addText("shpcode1", "shipping_code", 60)
  addText("shptrack", "shipping_tracking_number", 120)
  addText("shpturl1", "shipping_tracking_url", 400)
  addNumber("shpstat1", "shipping_status_code", 0, 2000)
  addText("shpstxt1", "shipping_status_text", 200)
  addNumber("shpfeq01", "shipping_fee_quoted", 0, null)
  addNumber("shpfea01", "shipping_fee_actual", 0, null)
  addNumber("shpcod01", "shipping_cod", 0, null)
  addNumber("shppayer", "shipping_payer", 0, 1)
  addBool("shpselm1", "shipping_selected_manually")
  addNumber("shpwt001", "shipping_chargeable_weight", 0, null)
  addText("shpprovc", "shipping_province_code", 20)
  addText("shpwardc", "shipping_ward_code", 20)
  addText("shpcityn", "shipping_city_name", 120)
  addText("shpdistn", "shipping_district_name", 120)
  addText("shpwardn", "shipping_ward_name", 120)
  addText("shpcityc", "shipping_city_code", 40)
  addText("shpdistc", "shipping_district_code", 40)
  addText("shpwardg", "shipping_ward_code_goship", 40)
  addText("shpcret1", "shipping_created_at", 40)
  addText("shpupd01", "shipping_updated_at", 40)
  addBool("shpret01", "shipping_returning")

  collection.indexes = [
    "CREATE INDEX `idx_orders_shipment_id` ON `orders` (`shipping_shipment_id`)",
    "CREATE INDEX `idx_orders_shipping_code` ON `orders` (`shipping_code`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("pnlvhbonsg171u2")

  collection.indexes = []

  const ids = [
    "shpprov1", "shpquot1", "shpopt01", "shpcar01", "shpcarnm", "shpsvc01", "shprate1",
    "shpship1", "shpcode1", "shptrack", "shpturl1", "shpstat1", "shpstxt1", "shpfeq01",
    "shpfea01", "shpcod01", "shppayer", "shpselm1", "shpwt001", "shpprovc", "shpwardc",
    "shpcityn", "shpdistn", "shpwardn", "shpcityc", "shpdistc", "shpwardg", "shpcret1",
    "shpupd01", "shpret01"
  ]
  for (const id of ids) collection.schema.removeField(id)

  return dao.saveCollection(collection)
})
