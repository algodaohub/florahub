/// <reference path="../pb_data/types.d.ts" />
migrate(
  (db) => {
    // Cache danh mục Goship không còn dùng: runtime đọc snapshot đóng gói + ward_downgrade_rules.
    const dao = new Dao(db)
    const collection = dao.findCollectionByNameOrId('shipping_locations')
    return dao.deleteCollection(collection)
  },
  (db) => {
    // Không khôi phục: collection chỉ là cache, sinh lại được bằng script đồng bộ trước đây.
  }
)
