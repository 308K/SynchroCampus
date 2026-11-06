// 邀请分享：短链复制 + 二维码
import { useEffect, useState } from 'react'
import { Button, CopyButton, Image, Popover, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCopy, IconCheck, IconQrcode } from '@tabler/icons-react'
import QRCode from 'qrcode'

interface SharePopoverProps {
  roomId: string
}

export function SharePopover({ roomId }: SharePopoverProps) {
  const [opened, setOpened] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const link = `${window.location.origin}/#/room/${roomId}`

  useEffect(() => {
    if (!opened || qr) return
    void QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: '#5726b9', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }, [opened, link, qr])

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" width={320} withArrow shadow="md">
      <Popover.Target>
        <Button variant="light" leftSection={<IconQrcode size={16} />} onClick={() => setOpened((v) => !v)}>
          分享邀请
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            邀请成员加入「序时」协同
          </Text>
          <TextInput readOnly value={link} rightSectionWidth={76} rightSection={
            <CopyButton value={link} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? '已复制' : '复制链接'}>
                  <Button size="compact-xs" color={copied ? 'brand' : 'gray'} onClick={copy} leftSection={copied ? <IconCheck size={12}/> : <IconCopy size={12} />}>
                    {copied ? '已复制' : '复制'}
                  </Button>
                </Tooltip>
              )}
            </CopyButton>
          } />
          {qr && <Image src={qr} maw={200} mx="auto" radius="sm" alt="房间邀请二维码" />}
          <Text size="xs" c="dimmed" ta="center">
            微信/QQ 扫码或转发链接，成员无需注册即可涂抹时间
          </Text>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}
