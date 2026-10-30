/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)

  // Collection phiếu chi hoa hồng CTV.
  const payouts = new Collection({
    "id": "affpayouts00001",
    "created": "2026-10-31 00:00:00.000Z",
    "updated": "2026-10-31 00:00:00.000Z",
    "name": "affiliate_payouts",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "afpynum0",
        "name": "number",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": true,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpyafil",
        "name": "affiliate",
        "type": "relation",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "hodszshy1vujjze",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": ["code"]
        }
      },
      {
        "system": false,
        "id": "afpystat",
        "name": "status",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 20, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpygros",
        "name": "gross_total",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "afpytaxr",
        "name": "tax_rate",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "afpytaxa",
        "name": "tax_total",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "afpynet0",
        "name": "net_total",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "afpycnt0",
        "name": "commission_count",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": null, "noDecimal": true }
      },
      {
        "system": false,
        "id": "afpymeth",
        "name": "method",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpyref0",
        "name": "reference",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 120, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpynote",
        "name": "note",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 500, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpybnk0",
        "name": "bank_name",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 120, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpynum1",
        "name": "bank_account_no",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpyown0",
        "name": "bank_account_name",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 120, "pattern": "" }
      },
      {
        "system": false,
        "id": "afpyperf",
        "name": "period_from",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": "", "max": "" }
      },
      {
        "system": false,
        "id": "afpypert",
        "name": "period_to",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": "", "max": "" }
      },
      {
        "system": false,
        "id": "afpypdat",
        "name": "paid_at",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": "", "max": "" }
      },
      {
        "system": false,
        "id": "afpycdat",
        "name": "cancelled_at",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": "", "max": "" }
      },
      {
        "system": false,
        "id": "afpycrat",
        "name": "created_at",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": "", "max": "" }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX `idx_affiliate_payouts_number` ON `affiliate_payouts` (`number`)",
      "CREATE INDEX `idx_affiliate_payouts_affiliate_status` ON `affiliate_payouts` (`affiliate`, `status`)"
    ],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  })
  dao.saveCollection(payouts)

  const affiliates = dao.findCollectionByNameOrId("hodszshy1vujjze")
  affiliates.schema.addField(new SchemaField({
    "system": false,
    "id": "afbnknam",
    "name": "bank_name",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": 120, "pattern": "" }
  }))
  affiliates.schema.addField(new SchemaField({
    "system": false,
    "id": "afbnknum",
    "name": "bank_account_no",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": 40, "pattern": "" }
  }))
  affiliates.schema.addField(new SchemaField({
    "system": false,
    "id": "afbnkown",
    "name": "bank_account_name",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": 120, "pattern": "" }
  }))
  affiliates.schema.addField(new SchemaField({
    "system": false,
    "id": "aftaxcod",
    "name": "tax_code",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": null, "max": 20, "pattern": "" }
  }))
  dao.saveCollection(affiliates)

  const commissions = dao.findCollectionByNameOrId("ckb7n8q3ysg3svd")
  commissions.schema.addField(new SchemaField({
    "system": false,
    "id": "afcmaprd",
    "name": "approved_at",
    "type": "date",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": "", "max": "" }
  }))
  commissions.schema.addField(new SchemaField({
    "system": false,
    "id": "afcmpdat",
    "name": "paid_at",
    "type": "date",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": { "min": "", "max": "" }
  }))
  commissions.schema.addField(new SchemaField({
    "system": false,
    "id": "afcmpyou",
    "name": "payout",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "affpayouts00001",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": 1,
      "displayFields": ["number"]
    }
  }))
  commissions.indexes = commissions.indexes.concat([
    "CREATE INDEX `idx_affiliate_commissions_payout` ON `affiliate_commissions` (`payout`)"
  ])
  dao.saveCollection(commissions)
}, (db) => {
  const dao = new Dao(db)

  const commissions = dao.findCollectionByNameOrId("ckb7n8q3ysg3svd")
  commissions.schema.removeField("afcmaprd")
  commissions.schema.removeField("afcmpdat")
  commissions.schema.removeField("afcmpyou")
  commissions.indexes = commissions.indexes.filter(
    (index) => !String(index).includes("idx_affiliate_commissions_payout")
  )
  dao.saveCollection(commissions)

  const affiliates = dao.findCollectionByNameOrId("hodszshy1vujjze")
  affiliates.schema.removeField("afbnknam")
  affiliates.schema.removeField("afbnknum")
  affiliates.schema.removeField("afbnkown")
  affiliates.schema.removeField("aftaxcod")
  dao.saveCollection(affiliates)

  return dao.deleteCollection(dao.findCollectionByNameOrId("affpayouts00001"))
})
