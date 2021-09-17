export interface BitbucketWebhook {
    user: string
    repository: {
        name: string,
        full_name: string
    }
    push: {
        changes: Change []
    }
}

export interface Change {
    new: {
        type: 'branch' | 'tag'
        name: string
        target: string
    } | null
    old: {
        type: 'branch' | 'tag'
        name: string
        target: string
    } | null
}
