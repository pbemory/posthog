import { Col, Dropdown, Input, Menu, Radio, Row, Select, Table, Tabs } from 'antd'
import { router } from 'kea-router'
import { useActions, useValues } from 'kea'
import { Link } from 'lib/components/Link'
import { ObjectTags } from 'lib/components/ObjectTags'
import { deleteWithUndo } from 'lib/utils'
import React from 'react'
import { DashboardItemType, InsightType, LayoutView, SavedInsightsTabs } from '~/types'
import { INSIGHTS_PER_PAGE, savedInsightsLogic } from './savedInsightsLogic'
import {
    AppstoreFilled,
    ArrowDownOutlined,
    ArrowUpOutlined,
    EllipsisOutlined,
    LeftOutlined,
    MenuOutlined,
    RightOutlined,
    StarFilled,
    StarOutlined,
    PlusOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons'
import './SavedInsights.scss'
import { organizationLogic } from 'scenes/organizationLogic'
import { DashboardItem } from 'scenes/dashboard/DashboardItem'
import { membersLogic } from 'scenes/organization/Settings/membersLogic'
import { normalizeColumnTitle } from 'lib/components/Table/utils'
import { DateFilter } from 'lib/components/DateFilter/DateFilter'

import { PageHeader } from 'lib/components/PageHeader'
import { SavedInsightsEmptyState, UNNAMED_INSIGHT_NAME } from 'scenes/insights/EmptyStates'
import { teamLogic } from '../teamLogic'
import {
    IconArrowDropDown,
    InsightsFunnelsIcon,
    InsightsLifecycleIcon,
    InsightsPathsIcon,
    InsightsRetentionIcon,
    InsightsSessionsIcon,
    InsightsStickinessIcon,
    InsightsTrendsIcon,
} from 'lib/components/icons'
import { SceneExport } from 'scenes/sceneTypes'
import { TZLabel } from 'lib/components/TimezoneAware'
import { ColumnsType } from 'antd/lib/table'
import { ProfilePicture } from 'lib/components/ProfilePicture'
import { urls } from 'scenes/urls'
import { eventUsageLogic } from 'lib/utils/eventUsageLogic'
import { dayjs } from 'lib/dayjs'

const { TabPane } = Tabs

interface SavedInsightType {
    type: InsightType
    name: string
    description?: string
    icon?: (props?: any) => JSX.Element
    inMenu: boolean
}

const insightTypes: SavedInsightType[] = [
    {
        type: InsightType.TRENDS,
        name: 'Trends',
        description: 'Understand how users are spending their time in your product',
        icon: InsightsTrendsIcon,
        inMenu: true,
    },
    {
        type: InsightType.FUNNELS,
        name: 'Funnels',
        description: 'Visualize completion and dropoff between events',
        icon: InsightsFunnelsIcon,
        inMenu: true,
    },
    {
        type: InsightType.SESSIONS,
        name: 'Sessions',
        description: 'Understand how users are spending their time in your product',
        icon: InsightsSessionsIcon,
        inMenu: false,
    },
    {
        type: InsightType.RETENTION,
        name: 'Retention',
        description: 'Visualize how many users return on subsequent days after a session',
        icon: InsightsRetentionIcon,
        inMenu: true,
    },
    {
        type: InsightType.PATHS,
        name: 'Paths',
        description: 'Understand how traffic is flowing through your product',
        icon: InsightsPathsIcon,
        inMenu: true,
    },
    {
        type: InsightType.STICKINESS,
        name: 'Stickiness',
        description: 'See how many days users performed an action within a timeframe',
        icon: InsightsStickinessIcon,
        inMenu: true,
    },
    {
        type: InsightType.LIFECYCLE,
        name: 'Lifecycle',
        description: 'See new, resurrected, returning, and dormant users',
        icon: InsightsLifecycleIcon,
        inMenu: true,
    },
]

export const scene: SceneExport = {
    component: SavedInsights,
    logic: savedInsightsLogic,
}

export const columnSort = (direction: 'up' | 'down' | 'none'): JSX.Element => (
    <div
        style={{
            fontSize: 10,
            paddingLeft: 8,
            whiteSpace: 'nowrap',
            width: 20,
            display: 'flex',
            justifyContent: 'center',
        }}
    >
        {direction === 'down' ? <ArrowDownOutlined /> : direction === 'up' ? <ArrowUpOutlined /> : null}
        <MenuOutlined />
    </div>
)

function NewInsightButton(): JSX.Element {
    const menu = (
        <Menu
            style={{
                maxWidth: '19rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--primary)',
                padding: '0.5rem',
            }}
        >
            {insightTypes.map(
                (listedInsightType) =>
                    listedInsightType.inMenu && (
                        <Menu.Item
                            key={listedInsightType.type}
                            onClick={() => {
                                eventUsageLogic.actions.reportSavedInsightNewInsightClicked(listedInsightType.type)
                                router.actions.push(urls.insightNew({ insight: listedInsightType.type }))
                            }}
                            data-attr="saved-insights-create-new-insight"
                            data-attr-insight-type={listedInsightType.type}
                        >
                            <Row wrap={false}>
                                <Col flex="none">
                                    {listedInsightType.icon && (
                                        <listedInsightType.icon color="var(--muted-alt)" noBackground />
                                    )}
                                </Col>
                                <Col flex="Auto" style={{ paddingLeft: '1rem' }}>
                                    <strong>{listedInsightType.name}</strong>
                                    <br />
                                    <div style={{ whiteSpace: 'initial', fontSize: '0.8125rem' }}>
                                        {listedInsightType.description}
                                    </div>
                                </Col>
                            </Row>
                        </Menu.Item>
                    )
            )}
        </Menu>
    )

    return (
        <Dropdown.Button
            overlayStyle={{ borderColor: 'var(--primary)' }}
            style={{ marginLeft: 8 }}
            type="primary"
            onClick={() => {
                router.actions.push(urls.insightNew({ insight: InsightType.TRENDS }))
            }}
            overlay={menu}
            icon={<IconArrowDropDown style={{ fontSize: 25 }} data-attr="saved-insights-new-insight-dropdown" />}
        >
            <PlusOutlined />
            New Insight
        </Dropdown.Button>
    )
}

export function SavedInsights(): JSX.Element {
    const { loadInsights, updateFavoritedInsight, renameInsight, duplicateInsight, setSavedInsightsFilters } =
        useActions(savedInsightsLogic)
    const { insights, count, insightsLoading, filters } = useValues(savedInsightsLogic)

    const { hasDashboardCollaboration } = useValues(organizationLogic)
    const { currentTeamId } = useValues(teamLogic)
    const { members } = useValues(membersLogic)

    const { tab, order, createdBy, layoutView, search, insightType, dateFrom, dateTo, page } = filters

    const startCount = (page - 1) * INSIGHTS_PER_PAGE + 1
    const endCount = page * INSIGHTS_PER_PAGE < count ? page * INSIGHTS_PER_PAGE : count

    const columns: ColumnsType<DashboardItemType> = [
        {
            title: '',
            dataIndex: 'id',
            key: 'id',
            className: 'icon-column',
            render: function renderType(_, insight) {
                const selectedType = insight.filters?.insight || InsightType.TRENDS
                const type = insightTypes.find(({ type: _type }) => _type === selectedType)
                if (type && type.icon) {
                    return <type.icon />
                }
            },
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: function renderName(name: string, insight) {
                return (
                    <Col>
                        <Row wrap={false}>
                            <Link to={urls.insightView(insight.short_id, insight.filters)} style={{ marginRight: 12 }}>
                                <strong>{name || <i>{UNNAMED_INSIGHT_NAME}</i>}</strong>
                            </Link>
                            <div
                                style={{ cursor: 'pointer', width: 'fit-content' }}
                                onClick={() => updateFavoritedInsight(insight, !insight.favorited)}
                            >
                                {insight.favorited ? (
                                    <StarFilled className="text-warning" />
                                ) : (
                                    <StarOutlined className="star-outlined" />
                                )}
                            </div>
                        </Row>
                        {hasDashboardCollaboration && (
                            <div className="text-muted-alt">
                                {insight.description || <i>No description provided</i>}
                            </div>
                        )}
                    </Col>
                )
            },
        },
        hasDashboardCollaboration
            ? {
                  title: 'Tags',
                  dataIndex: 'tags',
                  key: 'tags',
                  render: function renderTags(tags: string[]) {
                      return <ObjectTags tags={tags} staticOnly />
                  },
              }
            : {},
        {
            title: (
                <div
                    className="order-by"
                    onClick={() =>
                        setSavedInsightsFilters({ order: order === '-updated_at' ? 'updated_at' : '-updated_at' })
                    }
                >
                    Last modified{' '}
                    {columnSort(order === '-updated_at' ? 'down' : order === 'updated_at' ? 'up' : 'none')}
                </div>
            ),
            dataIndex: 'updated_at',
            key: 'updated_at',
            render: function renderLastModified(updated_at: string) {
                return <div style={{ whiteSpace: 'nowrap' }}>{updated_at && <TZLabel time={updated_at} />}</div>
            },
        },
        tab === SavedInsightsTabs.Yours
            ? {}
            : {
                  title: (
                      <div
                          className="order-by"
                          onClick={() =>
                              setSavedInsightsFilters({ order: order === 'created_by' ? '-created_by' : 'created_by' })
                          }
                      >
                          {normalizeColumnTitle('Created by')}{' '}
                          {columnSort(order === '-created_by' ? 'up' : order === 'created_by' ? 'down' : 'none')}
                      </div>
                  ),
                  render: function Render(_: any, item) {
                      return item.created_by ? (
                          <Row align="middle" wrap={false}>
                              <ProfilePicture
                                  name={item.created_by.first_name}
                                  email={item.created_by.email}
                                  size="md"
                              />
                              <div style={{ verticalAlign: 'middle', marginLeft: 8 }}>
                                  {item.created_by.first_name || item.created_by.email}
                              </div>
                          </Row>
                      ) : (
                          '-'
                      )
                  },
              },
        {
            title: '',
            className: 'options-column',
            render: function Render(_: any, item) {
                return (
                    <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Dropdown
                            placement="bottomRight"
                            trigger={['click']}
                            overlayStyle={{ minWidth: 240, border: '1px solid var(--primary)' }}
                            overlay={
                                <Menu
                                    style={{ padding: '12px 4px' }}
                                    data-attr={`insight-${item.short_id}-dropdown-menu`}
                                >
                                    <Menu.Item
                                        onClick={() => renameInsight(item)}
                                        data-attr={`insight-item-${item.short_id}-dropdown-rename`}
                                        title="Rename"
                                    >
                                        Rename
                                    </Menu.Item>
                                    <Menu.Item
                                        onClick={() => duplicateInsight(item)}
                                        data-attr={`insight-item-${item.short_id}-dropdown-duplicate`}
                                    >
                                        Duplicate
                                    </Menu.Item>
                                    <Menu.Item
                                        onClick={() =>
                                            deleteWithUndo({
                                                object: item,
                                                endpoint: `projects/${currentTeamId}/insights`,
                                                callback: loadInsights,
                                            })
                                        }
                                        style={{ color: 'var(--danger)' }}
                                        data-attr={`insight-item-${item.short_id}-dropdown-remove`}
                                    >
                                        Remove
                                    </Menu.Item>
                                </Menu>
                            }
                        >
                            <EllipsisOutlined
                                style={{ color: 'var(--primary)' }}
                                className="insight-dropdown-actions"
                            />
                        </Dropdown>
                    </Row>
                )
            },
        },
    ]

    return (
        <div className="saved-insights">
            <PageHeader title="Insights" buttons={<NewInsightButton />} />

            <Tabs
                activeKey={tab}
                style={{ borderColor: '#D9D9D9' }}
                onChange={(t) => setSavedInsightsFilters({ tab: t as SavedInsightsTabs })}
            >
                <TabPane tab="All Insights" key={SavedInsightsTabs.All} />
                <TabPane tab="Your Insights" key={SavedInsightsTabs.Yours} />
                <TabPane tab="Favorites" key={SavedInsightsTabs.Favorites} />
            </Tabs>
            <Row style={{ paddingBottom: 16, justifyContent: 'space-between' }}>
                <Col>
                    <Input.Search
                        allowClear
                        enterButton
                        placeholder="Search for insights"
                        style={{ width: 240 }}
                        onChange={(e) => setSavedInsightsFilters({ search: e.target.value })}
                        value={search || ''}
                        onSearch={() => loadInsights()}
                    />
                </Col>
                <Col>
                    Type
                    <Select
                        className="insight-type-icon-dropdown"
                        value={insightType}
                        style={{ paddingLeft: 8, width: 140 }}
                        onChange={(it) => setSavedInsightsFilters({ insightType: it })}
                    >
                        {[
                            { name: 'All types', type: 'All types' as InsightType, inMenu: false } as SavedInsightType,
                            ...insightTypes,
                        ].map((insight, index) => (
                            <Select.Option key={index} value={insight.type}>
                                <div className="insight-type-icon-wrapper">
                                    {insight.icon ? (
                                        <div className="icon-container">
                                            <div className="icon-container-inner">
                                                {<insight.icon color="#747EA2" noBackground />}
                                            </div>
                                        </div>
                                    ) : null}
                                    <div>{insight.name}</div>
                                </div>
                            </Select.Option>
                        ))}
                    </Select>
                </Col>
                <Col>
                    <span style={{ paddingRight: 8 }}>Last modified</span>
                    <DateFilter
                        defaultValue="All time"
                        disabled={false}
                        bordered={true}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onChange={(fromDate, toDate) => setSavedInsightsFilters({ dateFrom: fromDate, dateTo: toDate })}
                    />
                </Col>
                {tab !== SavedInsightsTabs.Yours ? (
                    <Col>
                        Created by
                        <Select
                            value={createdBy}
                            style={{ paddingLeft: 8, width: 140 }}
                            onChange={(cb) => {
                                setSavedInsightsFilters({ createdBy: cb })
                            }}
                        >
                            <Select.Option value={'All users'}>All users</Select.Option>
                            {members.map((member) => (
                                <Select.Option key={member.user.id} value={member.user.id}>
                                    {member.user.first_name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                ) : null}
            </Row>
            {insights.count > 0 && (
                <Row className="list-or-card-layout">
                    Showing {startCount} - {endCount} of {count} insights
                    <div>
                        <Radio.Group
                            onChange={(e) => setSavedInsightsFilters({ layoutView: e.target.value })}
                            value={layoutView}
                            buttonStyle="solid"
                        >
                            <Radio.Button value={LayoutView.List}>
                                <UnorderedListOutlined className="mr-05" />
                                List
                            </Radio.Button>
                            <Radio.Button value={LayoutView.Card}>
                                <AppstoreFilled className="mr-05" />
                                Card
                            </Radio.Button>
                        </Radio.Group>
                    </div>
                </Row>
            )}
            {!insightsLoading && insights.count < 1 ? (
                <SavedInsightsEmptyState />
            ) : (
                <>
                    {layoutView === LayoutView.List ? (
                        <Table
                            loading={insightsLoading}
                            columns={columns}
                            dataSource={insights.results}
                            pagination={false}
                            rowKey="id"
                            footer={() => (
                                <Row className="footer-pagination">
                                    <span className="text-muted-alt">
                                        {insights.count > 0 &&
                                            `Showing ${startCount} - ${endCount} of ${count} insights`}
                                    </span>
                                    <LeftOutlined
                                        style={{ paddingRight: 16 }}
                                        className={`${page === 1 ? 'paginate-disabled' : ''}`}
                                        onClick={() => {
                                            if (page > 1) {
                                                setSavedInsightsFilters({
                                                    page: page - 1,
                                                })
                                            }
                                        }}
                                    />
                                    <RightOutlined
                                        className={`${page * INSIGHTS_PER_PAGE >= count ? 'paginate-disabled' : ''}`}
                                        onClick={() => {
                                            if (page * INSIGHTS_PER_PAGE < count) {
                                                setSavedInsightsFilters({
                                                    page: page + 1,
                                                })
                                            }
                                        }}
                                    />
                                </Row>
                            )}
                        />
                    ) : (
                        <Row gutter={[16, 16]}>
                            {insights &&
                                insights.results.map((insight: DashboardItemType, index: number) => (
                                    <Col
                                        xs={24}
                                        sm={24}
                                        md={24}
                                        lg={12}
                                        xl={12}
                                        xxl={8}
                                        key={insight.short_id}
                                        style={{ height: 340 }}
                                    >
                                        <DashboardItem
                                            item={{ ...insight, color: null }}
                                            key={insight.short_id + '_user'}
                                            loadDashboardItems={() => {
                                                loadInsights()
                                            }}
                                            dashboardMode={null}
                                            index={index}
                                            isOnEditMode={false}
                                            footer={
                                                <div className="dashboard-item-footer">
                                                    {
                                                        <>
                                                            Saved {dayjs(insight.created_at).fromNow()} by{' '}
                                                            {insight.created_by?.first_name ||
                                                                insight.created_by?.email ||
                                                                'unknown'}
                                                        </>
                                                    }
                                                </div>
                                            }
                                        />
                                    </Col>
                                ))}
                        </Row>
                    )}
                </>
            )}
        </div>
    )
}
