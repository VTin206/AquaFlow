import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Card, DatePicker, Form, Input, Modal, Radio, Segmented, Select, Space, Switch, Table, Tag, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { Page } from '@/shared/components/Page'
import { QueryError } from '@/shared/components/QueryError'
import { TextArea } from '@/shared/components/TextArea'
import { useConfirm } from '@/shared/components/confirm'
import { useConfirmDiscard } from '@/shared/hooks/useConfirmDiscard'
import { relativeDateTime } from '@/shared/utils/format'
import { articleApi, articleDate, articleKeys, type Article, type ArticleInput, type ArticleKind } from './articleApi'
import { ArticleIcon, articleIcons } from './articleIcons'

const kindLabels: Record<ArticleKind, string> = { NEWS: 'Tin tức', POLICY: 'Chính sách' }
const shopPath = (article: Pick<Article, 'kind' | 'slug'>) => `/shop/${article.kind === 'POLICY' ? 'policy' : 'news'}/${article.slug}`

type Filter = 'ALL' | ArticleKind
type Editing = { kind: 'create' } | { kind: 'edit'; article: Article }

/** Chủ cửa hàng viết, đăng / ẩn và xóa tin tức, chính sách hiện trên trang khách. */
export function ArticlesPage() {
  const client = useQueryClient()
  const { message } = App.useApp()
  const confirm = useConfirm()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [editing, setEditing] = useState<Editing | null>(null)
  const query = useQuery({ queryKey: articleKeys.admin, queryFn: articleApi.list })

  // Lỗi (kể cả 409 do người khác vừa sửa) cũng tải lại danh sách để lần sửa sau dùng bản mới nhất.
  const refresh = () => client.invalidateQueries({ queryKey: articleKeys.all })
  const save = useMutation({
    mutationFn: (input: ArticleInput) =>
      editing?.kind === 'edit' ? articleApi.update(editing.article.id, input) : articleApi.create(input),
    onSuccess: async (saved) => {
      await refresh()
      setEditing(null)
      message.success(saved.published ? 'Đã lưu và đăng bài lên trang khách.' : 'Đã lưu bản nháp.')
    },
    onError: async (error) => {
      message.error(error.message)
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (article: Article) => articleApi.remove(article.id),
    onSuccess: async () => {
      await refresh()
      message.success('Đã xóa bài viết.')
    },
    onError: (error) => message.error(error.message),
  })

  const askRemove = async (article: Article) => {
    const ok = await confirm({
      title: `Xóa bài "${article.title}"?`,
      content: (
        <p>
          Bài bị xóa hẳn, link {shopPath(article)} không mở được nữa. Muốn giữ lại để đăng sau thì sửa bài và tắt "Đăng lên trang khách".
        </p>
      ),
      okText: 'Xóa bài',
      danger: true,
    })
    if (ok) remove.mutate(article)
  }

  const rows = (query.data ?? []).filter((article) => filter === 'ALL' || article.kind === filter)
  return (
    <Page
      title="Bài viết trang khách"
      actions={
        <Button type="primary" icon={<Plus size={16} />} onClick={() => setEditing({ kind: 'create' })}>
          Thêm bài viết
        </Button>
      }
    >
      {query.isError ? (
        <QueryError error={query.error} onRetry={query.refetch} />
      ) : (
        <Card>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'NEWS', label: kindLabels.NEWS },
              { value: 'POLICY', label: kindLabels.POLICY },
            ]}
            style={{ marginBottom: 16 }}
          />
          <Table<Article>
            rowKey="id"
            loading={query.isPending}
            dataSource={rows}
            scroll={{ x: 820 }}
            locale={{ emptyText: 'Chưa có bài viết nào.' }}
            columns={[
              {
                title: 'Bài viết',
                key: 'title',
                render: (_, article) => (
                  <Space align="start">
                    <ArticleIcon name={article.icon} size={20} aria-hidden />
                    <span>
                      <Typography.Text strong>{article.title}</Typography.Text>
                      <br />
                      <Typography.Text type="secondary">{article.summary}</Typography.Text>
                    </span>
                  </Space>
                ),
              },
              { title: 'Loại', dataIndex: 'kind', width: 110, render: (kind: ArticleKind) => kindLabels[kind] },
              {
                title: 'Trạng thái',
                dataIndex: 'published',
                width: 120,
                render: (published: boolean) => <Tag color={published ? 'green' : 'default'}>{published ? 'Đã đăng' : 'Bản nháp'}</Tag>,
              },
              {
                title: 'Ngày đăng',
                dataIndex: 'publishedOn',
                width: 120,
                render: (value: string | null) => (value ? articleDate(value) : '—'),
              },
              { title: 'Sửa lần cuối', dataIndex: 'updatedAt', width: 140, render: (value: string) => relativeDateTime(value) },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 150,
                align: 'center' as const,
                render: (_, article) => (
                  <Space size={4}>
                    <Button
                      type="text"
                      icon={<Pencil size={16} />}
                      aria-label={`Sửa ${article.title}`}
                      onClick={() => setEditing({ kind: 'edit', article })}
                    />
                    <Button
                      type="text"
                      icon={<ExternalLink size={16} />}
                      aria-label={`Xem ${article.title} trên trang khách`}
                      disabled={!article.published}
                      href={article.published ? shopPath(article) : undefined}
                      target="_blank"
                    />
                    <Button
                      type="text"
                      danger
                      icon={<Trash2 size={16} />}
                      aria-label={`Xóa ${article.title}`}
                      loading={remove.isPending && remove.variables?.id === article.id}
                      onClick={() => askRemove(article)}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}
      {editing && (
        <ArticleForm
          key={editing.kind === 'edit' ? editing.article.id : 'create'}
          editing={editing}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => save.mutate(input)}
        />
      )}
    </Page>
  )
}

type FormValues = Omit<ArticleInput, 'publishedOn' | 'version'> & { publishedOn?: Dayjs | null }

function ArticleForm({
  editing,
  saving,
  onClose,
  onSave,
}: {
  editing: Editing
  saving: boolean
  onClose: () => void
  onSave: (input: ArticleInput) => void
}) {
  const [form] = Form.useForm<FormValues>()
  const discard = useConfirmDiscard(form, onClose)
  const article = editing.kind === 'edit' ? editing.article : undefined
  const kind = Form.useWatch('kind', form) ?? article?.kind ?? 'NEWS'
  const initialValues: FormValues = article
    ? { ...article, publishedOn: article.publishedOn ? dayjs(article.publishedOn) : null }
    : { kind: 'NEWS', slug: '', title: '', summary: '', icon: 'newspaper', body: '', published: false, publishedOn: null }

  const submit = (values: FormValues) =>
    onSave({
      ...values,
      kind: article?.kind ?? values.kind,
      slug: values.slug?.trim() ?? '',
      publishedOn: kind === 'NEWS' && values.publishedOn ? values.publishedOn.format('YYYY-MM-DD') : null,
      version: article?.version,
    })

  return (
    <Modal
      open
      width={720}
      title={article ? `Sửa: ${article.title}` : 'Thêm bài viết'}
      onCancel={discard}
      closable={!saving}
      maskClosable={!saving}
      onOk={() => form.submit()}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" disabled={saving} onFinish={submit} initialValues={initialValues}>
        <Form.Item name="kind" label="Loại bài" extra={article ? 'Không đổi được loại của bài đã có.' : undefined}>
          <Radio.Group
            disabled={Boolean(article)}
            options={[
              { value: 'NEWS', label: 'Tin tức (trang chủ)' },
              { value: 'POLICY', label: 'Chính sách (chân trang)' },
            ]}
          />
        </Form.Item>
        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, whitespace: true, message: 'Nhập tiêu đề' }]}>
          <Input maxLength={200} showCount />
        </Form.Item>
        <Form.Item
          name="slug"
          label="Đường dẫn"
          extra={
            article
              ? 'Đổi đường dẫn thì link cũ đã chia sẻ sẽ không mở được.'
              : 'Để trống để tự tạo từ tiêu đề, ví dụ "binh-up-hay-binh-voi".'
          }
          rules={[
            {
              pattern: /^[a-z0-9]+(-[a-z0-9]+)*$/,
              message: 'Chỉ dùng chữ thường không dấu, số và dấu gạch ngang giữa các từ.',
            },
          ]}
        >
          <Input maxLength={120} addonBefore={kind === 'POLICY' ? '/shop/policy/' : '/shop/news/'} />
        </Form.Item>
        <Form.Item name="summary" label="Tóm tắt" rules={[{ required: true, whitespace: true, message: 'Nhập tóm tắt' }]}>
          <TextArea maxLength={300} showCount />
        </Form.Item>
        <Space wrap size="large" align="start">
          <Form.Item name="icon" label="Icon" rules={[{ required: true, message: 'Chọn icon' }]}>
            <Select
              style={{ width: 200 }}
              options={articleIcons.map(({ key, label, icon: Icon }) => ({
                value: key,
                label: (
                  <Space size={8}>
                    <Icon size={16} aria-hidden />
                    {label}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
          {kind === 'NEWS' && (
            <Form.Item name="publishedOn" label="Ngày đăng" extra="Để trống thì lấy ngày đăng bài.">
              <DatePicker format="DD/MM/YYYY" allowClear />
            </Form.Item>
          )}
        </Space>
        <Form.Item
          name="body"
          label="Nội dung"
          extra='Mỗi dòng là một đoạn. Dòng bắt đầu bằng "## " là tiêu đề nhỏ.'
          rules={[{ required: true, whitespace: true, message: 'Nhập nội dung' }]}
        >
          <TextArea rows={10} maxLength={20000} showCount />
        </Form.Item>
        <Form.Item name="published" label="Đăng lên trang khách" valuePropName="checked">
          <Switch checkedChildren="Đăng" unCheckedChildren="Nháp" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
