/**
 * Định nghĩa collection PocketBase cho dữ liệu hành chính Việt Nam (2 cấp).
 * Dùng chung cho scripts/setup-pocketbase.mjs và scripts/sync-pocketbase-locations.mjs.
 */

const text = (name, required = false) => ({
  name,
  type: 'text',
  required,
  presentable: false,
  unique: false,
  options: { min: null, max: null, pattern: '' }
})

const number = (name, required = false) => ({
  name,
  type: 'number',
  required,
  presentable: false,
  unique: false,
  options: { min: null, max: null, noDecimal: true }
})

const bool = (name) => ({
  name,
  type: 'bool',
  required: false,
  presentable: false,
  unique: false,
  options: {}
})

const relation = (name, collectionId) => ({
  name,
  type: 'relation',
  required: false,
  presentable: false,
  unique: false,
  options: {
    collectionId,
    cascadeDelete: false,
    minSelect: null,
    maxSelect: 1,
    displayFields: null
  }
})

const publicReadRules = {
  listRule: '',
  viewRule: '',
  createRule: null,
  updateRule: null,
  deleteRule: null
}

export const provincesCollection = {
  name: 'provinces',
  type: 'base',
  schema: [
    { ...number('code', true), unique: true },
    text('name', true),
    text('codename'),
    text('type'),
    number('phone_code'),
    number('ward_count'),
    number('sort_order')
  ],
  ...publicReadRules
}

export function wardsCollection(provinceCollectionId) {
  return {
    name: 'wards',
    type: 'base',
    schema: [
      {
        name: 'province',
        type: 'relation',
        required: true,
        presentable: false,
        unique: false,
        options: {
          collectionId: provinceCollectionId,
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: null
        }
      },
      number('province_code', true),
      { ...number('code', true), unique: true },
      text('name', true),
      text('codename'),
      text('type'),
      number('sort_order')
    ],
    ...publicReadRules
  }
}

export const locationMetaCollection = {
  name: 'location_meta',
  type: 'base',
  schema: [
    { ...text('key', true), unique: true },
    text('source'),
    text('standard'),
    text('updated_at'),
    number('province_count'),
    number('ward_count')
  ],
  ...publicReadRules
}

/**
 * Quan hệ ghi ngược: phường/xã mới (2 cấp) → địa chỉ cũ 3 cấp.
 * `old_*` là mã hành chính cũ (vd 79/769/26815), `goship_*` là mã hợp lệ của Goship
 * dùng khi báo giá và tạo vận đơn. Chỉ server đọc qua PB admin client.
 * `new_province`/`new_ward` là relation thật tới `provinces`/`wards`; các cột `*_code`
 * vẫn giữ text để resolver lọc trực tiếp, không cần expand relation.
 */
export function wardDowngradeRulesCollection(provinceCollectionId, wardCollectionId) {
  return {
    name: 'ward_downgrade_rules',
    type: 'base',
    schema: [
      relation('new_province', provinceCollectionId),
      text('new_province_code', true),
      text('new_province_name', true),
      relation('new_ward', wardCollectionId),
      text('new_ward_code', true),
      text('new_ward_name', true),
      text('old_province_code'),
      text('old_province_name'),
      text('old_district_code'),
      text('old_district_name'),
      text('old_ward_code'),
      text('old_ward_name'),
      text('goship_city_code', true),
      text('goship_city_name', true),
      text('goship_district_code', true),
      text('goship_district_name', true),
      text('goship_ward_code', true),
      text('goship_ward_name', true),
      bool('is_primary'),
      bool('active'),
      text('source'),
      text('note'),
      text('synced_at')
    ],
    indexes: [
      'CREATE INDEX `idx_ward_downgrade_new_ward` ON `ward_downgrade_rules` (`new_ward_code`)',
      'CREATE UNIQUE INDEX `idx_ward_downgrade_unique` ON `ward_downgrade_rules` (`new_ward_code`, `goship_ward_code`)'
    ],
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null
  }
}
