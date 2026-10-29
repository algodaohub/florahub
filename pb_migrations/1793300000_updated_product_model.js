/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)

  const text = (id, name, max) =>
    new SchemaField({
      system: false,
      id,
      name,
      type: "text",
      required: false,
      presentable: false,
      unique: false,
      options: { min: null, max, pattern: "" }
    })

  const number = (id, name, min, max) =>
    new SchemaField({
      system: false,
      id,
      name,
      type: "number",
      required: false,
      presentable: false,
      unique: false,
      options: { min, max, noDecimal: false }
    })

  const bool = (id, name) =>
    new SchemaField({
      system: false,
      id,
      name,
      type: "bool",
      required: false,
      presentable: false,
      unique: false,
      options: {}
    })

  const select = (id, name, values) =>
    new SchemaField({
      system: false,
      id,
      name,
      type: "select",
      required: false,
      presentable: false,
      unique: false,
      options: { maxSelect: 1, values }
    })

  const json = (id, name, maxSize) =>
    new SchemaField({
      system: false,
      id,
      name,
      type: "json",
      required: false,
      presentable: false,
      unique: false,
      options: { maxSize }
    })

  const file = (id, name, options) =>
    new SchemaField({
      system: false,
      id,
      name,
      type: "file",
      required: false,
      presentable: false,
      unique: false,
      options: {
        maxSelect: 1,
        maxSize: 26214400,
        mimeTypes: null,
        thumbs: [],
        protected: false,
        ...options
      }
    })

  const imageMimes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif", "image/avif"]
  const mediaMimes = imageMimes.concat(["video/mp4", "video/webm", "video/quicktime"])

  const products = dao.findCollectionByNameOrId("products")
  const productFields = [
    select("pf0000000000001", "type", ["physical", "digital", "service"]),
    bool("pf0000000000002", "requires_shipping"),
    number("pf0000000000003", "weight_grams", 0, 1000000),
    text("pf0000000000004", "seo_title", 120),
    text("pf0000000000005", "seo_description", 320),
    text("pf0000000000006", "seo_keywords", 300),
    text("pf0000000000007", "canonical_url", 500),
    text("pf0000000000008", "aeo_summary", 1200),
    json("pf0000000000009", "highlights", 10000),
    json("pf0000000000010", "faq", 20000),
    file("pf0000000000011", "digital_file", { maxSize: 52428800, protected: true }),
    number("pf0000000000012", "digital_download_limit", 0, 10000),
    number("pf0000000000013", "digital_expiry_days", 0, 3650),
    text("pf0000000000014", "digital_license", 5000),
    number("pf0000000000015", "service_duration", 0, 100000),
    text("pf0000000000016", "service_location", 200),
    number("pf0000000000017", "service_capacity", 0, 100000),
    text("pf0000000000018", "service_booking_note", 2000)
  ]
  productFields.forEach((field) => products.schema.addField(field))
  dao.saveCollection(products)

  const media = dao.findCollectionByNameOrId("product_images")
  const mediaFields = [
    select("pm0000000000001", "type", ["image", "video"]),
    file("pm0000000000002", "file", {
      maxSize: 26214400,
      mimeTypes: mediaMimes,
      thumbs: ["240x240"]
    }),
    file("pm0000000000003", "poster", { maxSize: 5242880, mimeTypes: imageMimes }),
    bool("pm0000000000004", "is_featured"),
    number("pm0000000000005", "duration", 0, 86400)
  ]
  mediaFields.forEach((field) => media.schema.addField(field))
  // Bản ghi upload mới chỉ có `file`, không có URL ngoài.
  media.schema.getFieldByName("url").required = false
  dao.saveCollection(media)

  const categories = dao.findCollectionByNameOrId("categories")
  const categoryFields = [
    text("pc0000000000001", "description", 2000),
    bool("pc0000000000003", "is_active"),
    text("pc0000000000004", "seo_title", 120),
    text("pc0000000000005", "seo_description", 320),
    file("pc0000000000007", "image", { maxSize: 5242880, mimeTypes: imageMimes }),
    new SchemaField({
      system: false,
      id: "pc0000000000002",
      name: "parent",
      type: "relation",
      required: false,
      presentable: false,
      unique: false,
      options: {
        collectionId: categories.id,
        cascadeDelete: false,
        minSelect: null,
        maxSelect: 1,
        displayFields: null
      }
    }),
    new SchemaField({
      system: false,
      id: "pc0000000000006",
      name: "updated_at",
      type: "date",
      required: false,
      presentable: false,
      unique: false,
      options: { min: "", max: "" }
    })
  ]
  categoryFields.forEach((field) => categories.schema.addField(field))
  return dao.saveCollection(categories)
}, (db) => {
  const dao = new Dao(db)

  const drop = (name, ids) => {
    const collection = dao.findCollectionByNameOrId(name)
    ids.forEach((id) => collection.schema.removeField(id))
    return dao.saveCollection(collection)
  }

  drop("products", [
    "pf0000000000001", "pf0000000000002", "pf0000000000003", "pf0000000000004",
    "pf0000000000005", "pf0000000000006", "pf0000000000007", "pf0000000000008",
    "pf0000000000009", "pf0000000000010", "pf0000000000011", "pf0000000000012",
    "pf0000000000013", "pf0000000000014", "pf0000000000015", "pf0000000000016",
    "pf0000000000017", "pf0000000000018"
  ])
  drop("product_images", [
    "pm0000000000001", "pm0000000000002", "pm0000000000003", "pm0000000000004",
    "pm0000000000005"
  ])
  drop("categories", [
    "pc0000000000001", "pc0000000000002", "pc0000000000003", "pc0000000000004",
    "pc0000000000005", "pc0000000000006", "pc0000000000007"
  ])
})
