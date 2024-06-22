import {
  createReleaseFromArchive,
  createReleaseFromDll,
  DownloadType,
  isGreater,
  Plugin,
  Release,
  Version
} from './plugin'
import * as github from '@actions/github'
import * as core from '@actions/core'
import { addAddonName } from './main'

const env = process.env
const envToken = env.INPUT_token
let token = core.getInput('token')
if (token === '' && envToken !== undefined) {
  token = envToken
}
const octokit = github.getOctokit(token)

export async function updateFromGithub(plugin: Plugin): Promise<void> {
  const [owner, repo] = plugin.host_url.split('/')

  const releases = await octokit.rest.repos.listReleases({
    owner: owner,
    repo: repo
  })
  let latestRelease = await octokit.rest.repos.getLatestRelease({
    owner: owner,
    repo: repo
  })

  plugin.release = await findAndCreateRelease(
    plugin,
    plugin.release,
    latestRelease
  )

  // find pre-release until latest release
  for (const release of releases.data) {
    if (release.prerelease) {
      plugin.prerelease = await findAndCreateRelease(
        plugin,
        plugin.prerelease,
        release
      )
      break
    } else if (release.tag_name == latestRelease.data.tag_name) {
      // TODO: if prerelease is set, we removed it
      plugin.prerelease = undefined
      break
    }
  }
}

/**
 *
 * @param plugin The plugin currently checked
 * @param oldRelease the old release (either plugin.release or plugin.prerelease)
 * @param githubRelease The github api response for the corresponding release/tag
 * @return oldRelease when the release didn't change or the new release
 * @throws Error when no valid release asset was found
 */
async function findAndCreateRelease(
  plugin: Plugin,
  oldRelease: Release | undefined,
  githubRelease: any
): Promise<Release | undefined> {
  if (checkAssetChanged(oldRelease, githubRelease.data)) {
    let found = false
    for (let i = 0; i < githubRelease.data.assets.length; i++) {
      const asset = githubRelease.data.assets[i]
      const release = await downloadFromGithub(plugin, asset)
      if (release !== undefined) {
        release.asset_index = i

        if (!oldRelease || isGreater(release.version, oldRelease.version)) {
          return release

          // TODO: new release was found
        }
        found = true
        break
      }
    }
    if (!found) {
      throw new Error(`no release asset found for plugin ${plugin.name}`)
    }
  }
  return oldRelease
}

async function downloadFromGithub(
  plugin: Plugin,
  asset: any
): Promise<Release | undefined> {
  const file = await fetch(asset.browser_download_url)
  if (!file.ok) {
    throw new Error(`Unable to download asset: ${asset.browser_download_url}`)
  }
  const fileBuffer = await file.arrayBuffer()
  let release: Release | undefined
  if (plugin.download_type == DownloadType.Dll) {
    release = createReleaseFromDll(
      plugin,
      fileBuffer,
      asset.id.toString(),
      asset.browser_download_url
    )
  } else {
    release = await createReleaseFromArchive(
      plugin,
      fileBuffer,
      asset.id.toString(),
      asset.browser_download_url
    )
  }

  if (release !== undefined) {
    addAddonName(plugin, release.name)
  }

  return release
}

function checkAssetChanged(
  release: Release | undefined,
  githubRelease: any
): boolean {
  if (!release || release.asset_index == undefined) {
    return true
  }
  const last_asset = githubRelease.data.assets[release.asset_index]
  return last_asset === undefined || last_asset.id.toString() !== release.id
}
