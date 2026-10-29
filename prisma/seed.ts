import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  { name: 'Hoa hồng', slug: 'hoa-hong', imageUrl: '/images/category-hoa-hong.svg', sortOrder: 1 },
  { name: 'Hoa cúc', slug: 'hoa-cuc', imageUrl: '/images/category-hoa-cuc.svg', sortOrder: 2 },
  { name: 'Baby', slug: 'baby', imageUrl: '/images/category-baby.svg', sortOrder: 3 },
  { name: 'Tulip', slug: 'tulip', imageUrl: '/images/category-tulip.svg', sortOrder: 4 },
  { name: 'Lan hồ điệp', slug: 'lan-ho-diep', imageUrl: '/images/category-lan-ho-diep.svg', sortOrder: 5 },
  { name: 'Phụ kiện', slug: 'phu-kien', imageUrl: '/images/category-phu-kien.svg', sortOrder: 6 }
]

const sellers = [
  { name: 'Vườn Đà Lạt', slug: 'vuon-da-lat', region: 'Lâm Đồng', rating: 4.8 },
  { name: 'Nhà vườn Mê Linh', slug: 'nha-vuon-me-linh', region: 'Hà Nội', rating: 4.6 },
  { name: 'Hợp tác xã Sapa', slug: 'htx-sapa', region: 'Lào Cai', rating: 4.7 }
]

type ProductSeed = {
  handle: string
  title: string
  subtitle: string
  description: string
  category: string
  seller: string
  basePrice: number
  unit: string
  flower: boolean
  color: string
  specs?: Array<[string, string]>
}

const products: ProductSeed[] = [
  {
    handle: 'hoa-hong-do-co-dien',
    title: 'Hồng đỏ cổ điển',
    subtitle: 'Cành dài, nụ to, màu đỏ sẫm',
    description: 'Hoa hồng đỏ cổ điển được tuyển chọn từ vườn Đà Lạt, cành dài và nụ chắc. Phù hợp cho bó hoa chúc mừng, hoa cưới và cắm bình.',
    category: 'hoa-hong',
    seller: 'vuon-da-lat',
    basePrice: 85000,
    unit: 'bó',
    flower: true,
    color: 'Đỏ sẫm'
  },
  {
    handle: 'hoa-hong-phan-pastel',
    title: 'Hồng phấn pastel',
    subtitle: 'Sắc hồng nhẹ, cánh mềm',
    description: 'Hồng phấn pastel với tông màu nhẹ nhàng, thích hợp cho hoa cưới, quà tặng và các dịp kỷ niệm.',
    category: 'hoa-hong',
    seller: 'vuon-da-lat',
    basePrice: 92000,
    unit: 'bó',
    flower: true,
    color: 'Hồng pastel'
  },
  {
    handle: 'cuc-trang-dai-doa',
    title: 'Cúc trắng đại đoá',
    subtitle: 'Đoá lớn, cánh đều, tươi lâu',
    description: 'Cúc trắng đại đoá có đường kính bông lớn, cánh dày và giữ form tốt. Lựa chọn quen thuộc cho hoa chúc mừng và hoa viếng.',
    category: 'hoa-cuc',
    seller: 'nha-vuon-me-linh',
    basePrice: 62000,
    unit: 'bó',
    flower: true,
    color: 'Trắng ngà'
  },
  {
    handle: 'cuc-vang-chanh',
    title: 'Cúc vàng chanh',
    subtitle: 'Màu vàng tươi, thân chắc',
    description: 'Cúc vàng chanh mang sắc vàng tươi sáng, thân chắc và lá xanh. Phù hợp cho hoa khai trương và trang trí sự kiện.',
    category: 'hoa-cuc',
    seller: 'nha-vuon-me-linh',
    basePrice: 58000,
    unit: 'bó',
    flower: true,
    color: 'Vàng chanh'
  },
  {
    handle: 'baby-trang-tuyet',
    title: 'Baby trắng tuyết',
    subtitle: 'Hoa nhỏ, phù hợp hoa phụ',
    description: 'Baby trắng tuyết là loại hoa phụ quen thuộc, giúp bó hoa thêm mềm mại và tự nhiên.',
    category: 'baby',
    seller: 'htx-sapa',
    basePrice: 72000,
    unit: 'bó',
    flower: true,
    color: 'Trắng tuyết'
  },
  {
    handle: 'baby-hong-phan',
    title: 'Baby hồng phấn',
    subtitle: 'Chùm nhỏ, màu hồng nhẹ',
    description: 'Baby hồng phấn có chùm hoa nhỏ, màu hồng nhẹ, thường dùng làm hoa phụ trong bó hoa cưới và hoa tặng.',
    category: 'baby',
    seller: 'htx-sapa',
    basePrice: 68000,
    unit: 'bó',
    flower: true,
    color: 'Hồng phấn'
  },
  {
    handle: 'tulip-do-ha-lan',
    title: 'Tulip đỏ Hà Lan',
    subtitle: 'Nhập khẩu, form chuẩn',
    description: 'Tulip đỏ nhập khẩu Hà Lan với form hoa chuẩn, màu đỏ nổi bật. Bảo quản lạnh để giữ hoa tươi lâu.',
    category: 'tulip',
    seller: 'vuon-da-lat',
    basePrice: 185000,
    unit: 'bó',
    flower: true,
    color: 'Đỏ'
  },
  {
    handle: 'tulip-hong-pastel',
    title: 'Tulip hồng pastel',
    subtitle: 'Mềm mại, sang trọng',
    description: 'Tulip hồng pastel mang vẻ đẹp mềm mại, phù hợp cho hoa cưới và quà tặng cao cấp.',
    category: 'tulip',
    seller: 'vuon-da-lat',
    basePrice: 178000,
    unit: 'bó',
    flower: true,
    color: 'Hồng pastel'
  },
  {
    handle: 'lan-ho-diep-trang',
    title: 'Lan hồ điệp trắng',
    subtitle: 'Chậu 3 cành, hoa bền',
    description: 'Lan hồ điệp trắng trong chậu 3 cành, hoa bền và dễ chăm sóc. Thích hợp làm quà tặng sang trọng.',
    category: 'lan-ho-diep',
    seller: 'htx-sapa',
    basePrice: 320000,
    unit: 'chậu',
    flower: true,
    color: 'Trắng'
  },
  {
    handle: 'lan-ho-diep-tim',
    title: 'Lan hồ điệp tím',
    subtitle: 'Chậu 3 cành, sắc tím',
    description: 'Lan hồ điệp tím với sắc hoa nổi bật, chậu 3 cành được ghép cân đối, phù hợp trang trí phòng khách.',
    category: 'lan-ho-diep',
    seller: 'htx-sapa',
    basePrice: 345000,
    unit: 'chậu',
    flower: true,
    color: 'Tím'
  },
  {
    handle: 'la-bac-ha',
    title: 'Lá bạc hà trang trí',
    subtitle: 'Phụ kiện cắm hoa',
    description: 'Lá bạc hà tươi dùng để lót và trang trí bó hoa, giúp tổng thể thêm xanh và cân đối.',
    category: 'phu-kien',
    seller: 'nha-vuon-me-linh',
    basePrice: 25000,
    unit: 'gói',
    flower: false,
    color: 'Xanh',
    specs: [
      ['Kích thước', 'Gói 10–12 nhánh'],
      ['Chất liệu', 'Lá tươi'],
      ['Màu sắc', 'Xanh đậm'],
      ['Quy cách', 'Gói kín, bảo quản mát'],
      ['Xuất xứ', 'Đà Lạt'],
      ['Hạn dùng', '2–3 ngày']
    ]
  },
  {
    handle: 'no-lua-thiep',
    title: 'Nơ lụa và thiệp',
    subtitle: 'Bộ phụ kiện gói quà',
    description: 'Bộ nơ lụa và thiệp chúc mừng dùng để hoàn thiện bó hoa hoặc hộp quà tặng.',
    category: 'phu-kien',
    seller: 'nha-vuon-me-linh',
    basePrice: 35000,
    unit: 'gói',
    flower: false,
    color: 'Kem',
    specs: [
      ['Kích thước', 'Nơ 2cm · thiệp 9x12cm'],
      ['Chất liệu', 'Lụa satin, giấy mỹ thuật'],
      ['Màu sắc', 'Kem / xanh rêu'],
      ['Quy cách', '1 nơ + 1 thiệp'],
      ['Xuất xứ', 'Việt Nam'],
      ['Hạn dùng', 'Không giới hạn']
    ]
  }
]

const reviewerNames = ['Chị Lan', 'Anh Minh', 'Chị Hương', 'Anh Tuấn', 'Chị Mai', 'Anh Dũng']
const reviewBodies = [
  'Hoa tươi, đóng gói cẩn thận, giao đúng hẹn.',
  'Cành đều và đẹp hơn mong đợi, sẽ đặt tiếp.',
  'Màu hoa đúng mô tả, giá hợp lý cho cửa hàng.',
  'Hoa giữ được khá lâu, khách rất hài lòng.'
]

function roundVnd(value: number) {
  return Math.round(value / 1000) * 1000
}

function dayOffset(days: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  console.log('Clearing existing data...')
  await prisma.affiliateCommission.deleteMany()
  await prisma.affiliateClick.deleteMany()
  await prisma.affiliate.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.cartItem.deleteMany()
  await prisma.cart.deleteMany()
  await prisma.review.deleteMany()
  await prisma.priceTrend.deleteMany()
  await prisma.stockTrend.deleteMany()
  await prisma.flashSaleItem.deleteMany()
  await prisma.flashSale.deleteMany()
  await prisma.variant.deleteMany()
  await prisma.productOptionValue.deleteMany()
  await prisma.productOption.deleteMany()
  await prisma.productSpec.deleteMany()
  await prisma.productImage.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.seller.deleteMany()
  await prisma.region.deleteMany()
  await prisma.promotion.deleteMany()
  await prisma.post.deleteMany()
  await prisma.banner.deleteMany()
  await prisma.address.deleteMany()
  await prisma.user.deleteMany()

  const region = await prisma.region.create({
    data: { name: 'Việt Nam', currencyCode: 'VND', taxRate: 0 }
  })

  const categoryMap = new Map<string, string>()
  for (const category of categories) {
    const created = await prisma.category.create({ data: category })
    categoryMap.set(created.slug, created.id)
  }

  const sellerMap = new Map<string, string>()
  for (const seller of sellers) {
    const created = await prisma.seller.create({ data: seller })
    sellerMap.set(created.slug, created.id)
  }

  const user = await prisma.user.create({
    data: {
      email: 'demo@florahub.vn',
      name: 'Khách Demo',
      affiliate: { create: { code: 'DEMO', commissionRate: 5 } },
      addresses: {
        create: {
          label: 'Nhà riêng',
          recipient: 'Khách Demo',
          phone: '0900000000',
          line1: '12 Nguyễn Huệ',
          ward: 'Phường Sài Gòn',
          city: 'Thành phố Hồ Chí Minh',
          isDefault: true
        }
      }
    }
  })

  await prisma.promotion.create({
    data: { code: 'WELCOME10', type: 'percentage', value: 10, active: true }
  })

  await prisma.banner.createMany({
    data: [
      {
        image: '/images/hero-1.svg',
        title: 'Hoa tươi mỗi ngày',
        subtitle: 'Nguồn hoa ổn định · Giá minh bạch · Giao trong ngày',
        href: '/categories',
        sortOrder: 1
      },
      {
        image: '/images/hero-2.svg',
        title: 'Ưu đãi theo mùa',
        subtitle: 'Chọn sản phẩm theo mùa để tối ưu chi phí',
        href: '/flash-sale',
        sortOrder: 2
      }
    ]
  })

  const createdProducts: Array<{ id: string; handle: string; variantId: string; price: number }> = []

  for (const [index, item] of products.entries()) {
    const imageIndex = index + 1
    const gallery = [
      `/images/product-${imageIndex}.svg`,
      `/images/product-${((index + 4) % products.length) + 1}.svg`,
      `/images/product-${((index + 7) % products.length) + 1}.svg`
    ]

    const specs: Array<[string, string]> =
      item.specs ??
      [
        ['Chiều dài cành', item.unit === 'chậu' ? '35–45cm' : '45–55cm'],
        ['Độ dày cành', 'Dày, khoẻ'],
        ['Dáng cành', 'Cành thẳng'],
        ['Màu hoa', item.color],
        ['Độ tươi', 'Thu hoạch trong ngày'],
        ['Xuất xứ', item.category === 'tulip' ? 'Nhập khẩu Hà Lan' : 'Đà Lạt']
      ]

    const variantTitles = item.flower ? ['Hạng A', 'Hạng B', 'Hạng C'] : ['Tiêu chuẩn', 'Cao cấp']
    const variantMultipliers = item.flower ? [1, 0.82, 0.68] : [1, 1.6]

    const created = await prisma.product.create({
      data: {
        handle: item.handle,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        color: item.color,
        categoryId: categoryMap.get(item.category)!,
        sellerId: sellerMap.get(item.seller)!,
        thumbnail: gallery[0],
        unit: item.unit,
        images: {
          create: gallery.map((url, sortOrder) => ({
            url,
            alt: `${item.title} — ảnh ${sortOrder + 1}`,
            sortOrder
          }))
        },
        specs: {
          create: specs.map(([name, value], sortOrder) => ({ name, value, sortOrder }))
        },
        options: {
          create: [
            {
              title: item.flower ? 'Hạng' : 'Phân loại',
              sortOrder: 0,
              values: {
                create: variantTitles.map((value, sortOrder) => ({ value, sortOrder }))
              }
            }
          ]
        },
        variants: {
          create: variantTitles.map((title, variantIndex) => ({
            title,
            sku: `${item.handle}-${variantIndex + 1}`,
            price: roundVnd(item.basePrice * variantMultipliers[variantIndex]!),
            compareAtPrice: variantIndex === 0 ? roundVnd(item.basePrice * 1.15) : null,
            inventoryQuantity: 40 + variantIndex * 30,
            optionsJson: JSON.stringify([{ name: item.flower ? 'Hạng' : 'Phân loại', value: title }])
          }))
        }
      },
      include: { variants: true }
    })

    const firstVariant = created.variants[0]!
    createdProducts.push({
      id: created.id,
      handle: created.handle,
      variantId: firstVariant.id,
      price: firstVariant.price
    })

    for (let day = 0; day < 30; day += 1) {
      const wave = Math.sin((day + index) / 3) * 0.08 + (day / 30) * 0.05
      const price = roundVnd(item.basePrice * (0.94 + wave))
      const stock = Math.max(5, Math.round(60 + Math.cos((day + index) / 4) * 30 + day))
      await prisma.priceTrend.create({
        data: { productId: created.id, date: dayOffset(day - 29), price }
      })
      await prisma.stockTrend.create({
        data: { productId: created.id, date: dayOffset(day - 29), stock }
      })
    }

    for (let r = 0; r < 2; r += 1) {
      await prisma.review.create({
        data: {
          productId: created.id,
          authorName: reviewerNames[(index + r) % reviewerNames.length]!,
          rating: r === 0 ? 5 : 4,
          body: reviewBodies[(index + r) % reviewBodies.length]!,
          createdAt: dayOffset(-(r + 1) * 3)
        }
      })
    }
  }

  const flashSale = await prisma.flashSale.create({
    data: {
      title: 'Ưu đãi hôm nay',
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      active: true
    }
  })

  for (const [i, product] of createdProducts.slice(0, 4).entries()) {
    await prisma.flashSaleItem.create({
      data: {
        flashSaleId: flashSale.id,
        productId: product.id,
        variantId: product.variantId,
        salePrice: roundVnd(product.price * 0.85),
        quantityLimit: 8 + i * 2
      }
    })
  }

  const posts = [
    {
      slug: 'bao-quan-hoa-hong-tuoi-lau',
      title: 'Cách bảo quản hoa hồng tươi lâu',
      excerpt: 'Ba bước đơn giản giúp hoa hồng giữ form và màu sắc trong 5–7 ngày.',
      coverUrl: '/images/post-1.svg',
      body: 'Cắt chéo gốc 2–3cm, thay nước mỗi ngày và giữ hoa ở nơi thoáng mát. Tránh ánh nắng trực tiếp và khí thải từ trái cây chín.'
    },
    {
      slug: 'chon-hoa-theo-mua',
      title: 'Hướng dẫn chọn hoa theo mùa',
      excerpt: 'Mỗi mùa có một số loại hoa đẹp nhất và giá tốt nhất.',
      coverUrl: '/images/post-2.svg',
      body: 'Mùa xuân phù hợp với tulip và cúc; mùa hè là baby và hướng dương; cuối năm là lan và hồng nhập khẩu. Chọn theo mùa giúp giảm chi phí và tăng độ tươi.'
    },
    {
      slug: 'kinh-nghiem-nhap-hoa',
      title: 'Kinh nghiệm nhập hoa cho cửa hàng',
      excerpt: 'Cách tính giá vốn, dự trù số lượng và chọn nhà cung cấp ổn định.',
      coverUrl: '/images/post-3.svg',
      body: 'Dự trù theo lịch sự kiện, đặt cọc với nhà vườn quen và luôn có phương án dự phòng cho ngày cao điểm. Ghi chép tỷ lệ hao hụt để điều chỉnh giá bán.'
    }
  ]

  for (const post of posts) {
    await prisma.post.create({ data: post })
  }

  const cart = await prisma.cart.create({
    data: { regionId: region.id, userId: user.id, email: user.email }
  })

  console.log(`Seeded ${createdProducts.length} products, ${categories.length} categories, ${sellers.length} sellers.`)
  console.log(`Demo cart: ${cart.id}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
