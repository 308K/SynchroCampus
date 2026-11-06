// Mantine 主题（紫蓝基调 · OKLCH hue 280 对应色阶）
import { createTheme, type MantineColorsTuple } from '@mantine/core'

const brand: MantineColorsTuple = [
  '#f5f2ff',
  '#e6ddff',
  '#cdbdff',
  '#b294ff',
  '#9c73ff',
  '#8c5cff',
  '#8450ff',
  '#7039e6',
  '#652fd2',
  '#5a29bf',
]

export const theme = createTheme({
  colors: {
    brand,
  },
  primaryColor: 'brand',
  primaryShade: 6,
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
