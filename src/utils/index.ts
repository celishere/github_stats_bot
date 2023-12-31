import dotenv from "dotenv";
import axios from "axios";

import { Markup } from "telegraf";
import { InlineKeyboardButton } from "telegraf/src/core/types/typegram";

import { Commit, CommitData, Payload } from "../types/Payload";
import { GenerateResponse, Response } from "../types/Response";
import { Hideable } from "../types/Types";

dotenv.config({
    path: `${ __dirname }/../../.env`
})

//sorry

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const TEXT_TITLE = process.env.TEXT_TITLE;

const TEXT_COMMIT_1 = process.env.TEXT_COMMIT_1;
const TEXT_COMMIT_2 = process.env.TEXT_COMMIT_2;

const NEW_WORD_1 = process.env.NEW_WORD_1;
const NEW_WORD_2 = process.env.NEW_WORD_2;

const COMMIT_WORD_1 = process.env.COMMIT_WORD_1;
const COMMIT_WORD_2 = process.env.COMMIT_WORD_2;

const TEXT_SUMMARY = process.env.TEXT_SUMMARY;

const INLINE_COMMIT_1 = process.env.INLINE_COMMIT_1;
const INLINE_COMMIT_2 = process.env.INLINE_COMMIT_2;

export async function generate(payload: Payload): Promise<GenerateResponse> {
    let keyboard: Hideable<InlineKeyboardButton.UrlButton>[][] = []

    let total_added = 0
    let total_removed = 0

    const commits = payload.commits.length

    const commits_url = payload.repository.commits_url

    const repo_name = payload.repository.name
    const branch_name = payload.ref.replace('refs/heads/', '')

    const new_word = commits > 1 ? NEW_WORD_1 : NEW_WORD_2
    const commit_word = commits > 1 ? COMMIT_WORD_1 : COMMIT_WORD_2

    let text = toEscape(
        replaceVariables(TEXT_TITLE, { new_word, commit_word, repo_name, branch_name })
    )

    keyboard.push([Markup.button.url(INLINE_COMMIT_1, payload.compare)])

    const commitButtons: Hideable<InlineKeyboardButton.UrlButton>[] = []

    for (const commit of payload.commits) {
        const index = payload.commits.indexOf(commit);

        const response = await processCommit(index + 1, commit, commits_url)

        text += response.text

        total_added += response.added
        total_removed += response.removed

        commitButtons.push(response.button)
    }

    keyboard.push(commitButtons)

    text += replaceVariables(TEXT_SUMMARY, { total_added, total_removed })

    return {
        text: text,
        keyboard: Markup.inlineKeyboard(keyboard)
    }
}

async function processCommit(index: number, commit: Commit, commitsUrl: string): Promise<Response> {
    const message = commit.message

    const url = commit.url

    const commitUrl = commitsUrl.replace('{/sha}', `/${ commit.id }`)

    const data = await getCommitData(commitUrl)

    const added = data.stats.additions
    const removed = data.stats.deletions

    const author = commit.author.username

    let text = toEscape(
        replaceVariables(TEXT_COMMIT_1, { index, message, added, removed, author })
    )

    text += replaceVariables(TEXT_COMMIT_2, { index, url })

    const button = Markup.button.url(
        replaceVariables(INLINE_COMMIT_2, { index }),
        url
    )

    return {
        text,
        added,
        removed,
        button
    }
}

function replaceVariables(template: string, replacements: Record<string, any>): string {
    return template.replace(/\{(\w+)}/g, (_, match) => {
        const replacement = replacements[match];

        if (replacement !== undefined) {
            return String(replacement);
        }

        return match;
    });
}

function toEscape(str: string): string {
    return str
        .replace(/_/g, "\\_")
        .replace(/~/g, "\\~")
        .replace(/`/g, "\\`")
        .replace(/\./g, "\\.");
}

async function getCommitData(url: string): Promise<CommitData> {
    try {
        const response = await axios.get(
            url,
            {
                headers: {
                    'Authorization': `token ${ GITHUB_TOKEN }`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        )

        return response.data
    } catch (e) {
        throw e
    }
}