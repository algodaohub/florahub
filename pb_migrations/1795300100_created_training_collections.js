/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)

  const trainingExamples = new Collection({
    "id": "trnexamples0001",
    "created": "2026-10-31 12:00:00.000Z",
    "updated": "2026-10-31 12:00:00.000Z",
    "name": "training_examples",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "tq_question00001",
        "name": "question",
        "type": "text",
        "required": true,
        "presentable": true,
        "unique": false,
        "options": { "min": null, "max": 2000, "pattern": "" }
      },
      {
        "system": false,
        "id": "tq_answer0000001",
        "name": "answer",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 4000, "pattern": "" }
      },
      {
        "system": false,
        "id": "tq_source0000001",
        "name": "source",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 200, "pattern": "" }
      },
      {
        "system": false,
        "id": "tq_batch0000001",
        "name": "batch",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 40, "pattern": "" }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  })

  const assistantBrief = new Collection({
    "id": "astbrief0000001",
    "created": "2026-10-31 12:00:00.000Z",
    "updated": "2026-10-31 12:00:00.000Z",
    "name": "assistant_brief",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "ab_content00001",
        "name": "content",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 4000, "pattern": "" }
      },
      {
        "system": false,
        "id": "ab_model0000001",
        "name": "model",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": null, "max": 160, "pattern": "" }
      },
      {
        "system": false,
        "id": "ab_updated00001",
        "name": "updated_at",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": { "min": "", "max": "" }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  })

  dao.saveCollection(trainingExamples)
  return dao.saveCollection(assistantBrief)
}, (db) => {
  const dao = new Dao(db)
  for (const id of ["trnexamples0001", "astbrief0000001"]) {
    try {
      dao.deleteCollection(dao.findCollectionByNameOrId(id))
    } catch {}
  }
})
