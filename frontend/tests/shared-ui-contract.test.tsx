// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from '../src/shared/ui/button'
import { Input } from '../src/shared/ui/input'
import { Textarea } from '../src/shared/ui/textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../src/shared/ui/card'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../src/shared/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel } from '../src/shared/ui/dropdown-menu'

beforeEach(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))
afterEach(() => vi.unstubAllGlobals())

describe('SocCO shared UI component contracts', () => {
  it('defaults buttons to non-submit, preserving submit and caller override', () => {
    expect(renderToStaticMarkup(<Button>Action</Button>)).toContain('type="button"')
    expect(renderToStaticMarkup(<Button type="submit">Send</Button>)).toContain('type="submit"')
    expect(renderToStaticMarkup(<Button type="reset" className="custom">Reset</Button>)).toContain('custom')
  })

  it('keeps button variants, sizes, disabled semantics and token mapping', () => {
    const html = renderToStaticMarkup(<Button size="sm" variant="destructive" disabled aria-label="Xóa"><span aria-hidden>×</span></Button>)
    expect(html).toContain('data-slot="button"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-label="Xóa"')
    expect(html).toContain('bg-destructive')
    expect(html).toContain('rounded-ui-md')
    expect(html).toContain('text-[length:var(--soco-type-body)]')
    expect(html).toContain('h-9')
  })

  it('supports native input types and a11y props without losing visual tokens', () => {
    const html = renderToStaticMarkup(<Input id="email" type="email" autoComplete="email" required aria-invalid="true" />)
    expect(html).toContain('type="email"')
    expect(html).toContain('required=""')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('rounded-ui-md')
    expect(html).toContain('text-[length:var(--soco-type-body)]')
  })

  it('preserves textarea native behavior and accessibility metadata', () => {
    const html = renderToStaticMarkup(<Textarea id="bio" rows={3} disabled aria-describedby="bio-help" defaultValue="Xin chào" />)
    expect(html).toContain('data-slot="textarea"')
    expect(html).toContain('rows="3"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-describedby="bio-help"')
    expect(html).toContain('Xin chào')
  })

  it('renders a semantic card using optional content slots and caller classes', () => {
    const html = renderToStaticMarkup(
      <Card aria-label="Tóm tắt" className="custom-card">
        <CardHeader><CardTitle>Tổng quan</CardTitle><CardDescription>Mô tả</CardDescription></CardHeader>
        <CardContent>Nội dung</CardContent>
        <CardFooter>Thao tác</CardFooter>
      </Card>,
    )
    for (const slot of ['card', 'card-header', 'card-title', 'card-description', 'card-content', 'card-footer']) {
      expect(html).toContain(`data-slot="${slot}"`)
    }
    expect(html).toContain('<section')
    expect(html).toContain('<h3')
    expect(html).toContain('aria-label="Tóm tắt"')
    expect(html).toContain('rounded-ui-lg')
    expect(html).toContain('custom-card')
  })

  it('preserves dialog title and description semantics with design tokens', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () => root.render(
        <Dialog open>
          <DialogContent>
            <DialogTitle>Tiêu đề</DialogTitle>
            <DialogDescription>Chi tiết</DialogDescription>
          </DialogContent>
        </Dialog>,
      ))
      const title = document.querySelector('[data-slot="dialog-title"]')
      const description = document.querySelector('[data-slot="dialog-description"]')
      expect(title?.textContent).toBe('Tiêu đề')
      expect(title?.className).toContain('text-[length:var(--soco-type-section)]')
      expect(description?.textContent).toBe('Chi tiết')
      expect(description?.className).toContain('text-[length:var(--soco-type-body)]')
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })

  it('keeps dropdown item accessibility and checked/disabled contracts', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    try {
      await act(async () => root.render(
        <DropdownMenu open>
          <DropdownMenuTrigger>Mở menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Nhóm mục</DropdownMenuLabel>
            <DropdownMenuItem disabled aria-label="Không khả dụng">Một mục</DropdownMenuItem>
            <DropdownMenuCheckboxItem checked>Đã chọn</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      ))
      const item = document.querySelector('[data-slot="dropdown-menu-item"]')
      const checkbox = document.querySelector('[data-slot="dropdown-menu-checkbox-item"]')
      expect(item?.getAttribute('data-disabled')).toBe('')
      expect(item?.className).toContain('rounded-ui-sm')
      expect(checkbox?.getAttribute('data-state')).toBe('checked')
      expect(document.querySelector('[data-slot="dropdown-menu-label"]')?.textContent).toBe('Nhóm mục')
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})
