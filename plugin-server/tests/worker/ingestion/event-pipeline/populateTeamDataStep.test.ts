import { PipelineEvent, Team } from '../../../../src/types'
import { UUIDT } from '../../../../src/utils/utils'
import { populateTeamDataStep } from '../../../../src/worker/ingestion/event-pipeline/populateTeamDataStep'
import { getMetricValues, resetMetrics } from '../../../helpers/metrics'

const pipelineEvent: PipelineEvent = {
    event: '$pageview',
    properties: { foo: 'bar' },
    timestamp: '2020-02-23T02:15:00Z',
    now: '2020-02-23T02:15:00Z',
    team_id: 2,
    distinct_id: 'my_id',
    ip: '127.0.0.1',
    site_url: 'https://example.com',
    uuid: new UUIDT().toString(),
    token: 'token',
}

const team: Team = {
    id: 2,
    uuid: 'af95d312-1a0a-4208-b80f-562ddafc9bcd',
    organization_id: '66f3f7bf-44e2-45dd-9901-5dbd93744e3a',
    name: 'testTeam',
    anonymize_ips: false,
    api_token: 'token',
    slack_incoming_webhook: '',
    session_recording_opt_in: false,
    ingested_event: true,
}

let runner: any

beforeEach(() => {
    resetMetrics()
    runner = {
        nextStep: (...args: any[]) => args,
        hub: {
            teamManager: {
                getTeamByToken: jest.fn(() => team),
            },
        },
    }
})

describe('populateTeamDataStep()', () => {
    it('event with no token is not processed and the step returns null', async () => {
        const response = await populateTeamDataStep(runner, { ...pipelineEvent, team_id: undefined, token: undefined })
        expect(response).toEqual(null)
        expect(await getMetricValues('ingestion_event_dropped_total')).toEqual([
            {
                labels: {
                    drop_cause: 'no_token',
                    event_type: 'analytics',
                },
                value: 1,
            },
        ])
    })

    it('event with an invalid token is not processed and the step returns null', async () => {
        jest.mocked(runner.hub.teamManager.getTeamByToken).mockReturnValue(null)
        const response = await populateTeamDataStep(runner, { ...pipelineEvent, team_id: undefined, token: 'unknown' })
        expect(response).toEqual(null)
        expect(await getMetricValues('ingestion_event_dropped_total')).toEqual([
            {
                labels: {
                    drop_cause: 'invalid_token',
                    event_type: 'analytics',
                },
                value: 1,
            },
        ])
    })

    it('event with a valid token gets assigned a team_id keeps its ip', async () => {
        const response = await populateTeamDataStep(runner, { ...pipelineEvent, team_id: undefined })

        expect(response).toEqual({ ...pipelineEvent, team_id: 2, ip: '127.0.0.1' })
        expect(await getMetricValues('ingestion_event_dropped_total')).toEqual([])
    })

    it('event with a valid token for a team with anonymize_ips=true gets its ip set to null', async () => {
        jest.mocked(runner.hub.teamManager.getTeamByToken).mockReturnValue({ ...team, anonymize_ips: true })
        const response = await populateTeamDataStep(runner, { ...pipelineEvent, team_id: undefined })

        expect(response).toEqual({ ...pipelineEvent, team_id: 2, ip: null })
        expect(await getMetricValues('ingestion_event_dropped_total')).toEqual([])
    })

    it('team_id from the event is preferred to the one returned by teamManager', async () => {
        // Temporary behaviour while we progressively rollout this change: trust capture
        jest.mocked(runner.hub.teamManager.getTeamByToken).mockReturnValue({ ...team, anonymize_ips: true })
        const response = await populateTeamDataStep(runner, { ...pipelineEvent, team_id: 43, token: 'unknown' })
        expect(response.team_id).toEqual(43)
        expect(await getMetricValues('ingestion_team_resolution_checks_total')).toEqual([
            {
                labels: { check_ok: 'false' },
                value: 1,
            },
        ])
    })
})
