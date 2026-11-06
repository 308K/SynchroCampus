// Mantine 主题（主色调 #ddaacc 粉紫色系，色阶围绕该色展开）
import { createTheme, type MantineColorsTuple } from '@mantine/core'

// #ddaacc 位于 shade 3；更深的 shade 用于填充按钮/链接以保证白字对比度
const brand: MantineColorsTuple = [
  '#faf4f8',
  '#f3e4ee',
  '#e9cfe1',
  '#ddaacc',
  '#cf93bc',
  '#c07cad',
  '#b0669d',
  '#9a5489',
  '#854676',
  '#6d3a61',
]

export const theme = createTheme({
  colors: {
    brand,
  },
  primaryColor: 'brand',
  primaryShade: { light: 7, dark: 6 },
  defaultRadius: 'md',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, "Microsoft YaHei UI", sans-serif',
  headings: {
    fontWeight: '700',
  },
  components: {
    Modal: {
      styles: {
        title: { fontWeight: 700 },
      },
    },
  },
})
