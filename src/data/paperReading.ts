// 文献阅读批次系列页的共享数据源。
// 新增批次时：往 paperReadingBatches 追加一项，并新建 paper-reading-N/index.mdx。
export const paperReadingBatches = [
  { id: 'batch-1', title: '第 1 批', order: 1, href: '/blog/paper-reading-1' }
]

export const paperReadingCategories = [
  { id: 'paper-reading-batches', title: '批次', items: paperReadingBatches }
]
