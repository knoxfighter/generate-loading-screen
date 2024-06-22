import {
  createReleaseFromArchive,
  createReleaseFromDll,
  DownloadType,
  isGreater,
  Plugin,
  Release
} from './plugin'
import { addAddonName } from './main'

export async function updateStandalone(plugin: Plugin): Promise<void> {
  if (!plugin.version_url) {
    throw new Error(`no version_url for plugin ${plugin.name}`)
  }
  plugin.release = await downloadAndCheckVersion(
    plugin,
    plugin.release,
    plugin.version_url,
    plugin.host_url
  )

  // only run when configured and release was found
  if (
    plugin.prerelease_host_url &&
    plugin.prerelease_version_url &&
    plugin.release
  ) {
    const prerelease = await downloadAndCheckVersion(
      plugin,
      plugin.prerelease,
      plugin.prerelease_version_url,
      plugin.prerelease_host_url
    )

    // check if prerelease is later than release, if not, remove prerelease
    if (prerelease) {
      if (isGreater(prerelease.version, plugin.release.version)) {
        // TODO: new release was found die zweite
        plugin.prerelease = prerelease
        return
      }
    }
  }

  // TODO: if prerelease is set, we removed it
  plugin.prerelease = undefined
}

async function downloadAndCheckVersion(
  plugin: Plugin,
  oldRelease: Release | undefined,
  version_url: string,
  host_url: string
): Promise<Release | undefined> {
  const versionRes = await fetch(version_url)
  if (versionRes.status !== 200) {
    throw new Error(
      `version response status for plugin ${plugin.name}: ${versionRes.status}`
    )
  }
  const version = await versionRes.text()

  if (!oldRelease || oldRelease.id !== version) {
    const release = await downloadStandalone(plugin, host_url, version)
    if (release !== undefined) {
      if (!oldRelease || isGreater(release.version, oldRelease.version)) {
        return release

        // TODO: new release was found
      }
      return oldRelease
    }

    throw new Error(`no release asset found for plugin ${plugin.name}`)
  }

  return oldRelease
}

async function downloadStandalone(
  plugin: Plugin,
  host_url: string,
  id: string
): Promise<Release | undefined> {
  const file = await fetch(host_url)
  if (!file.ok) {
    throw new Error(`Unable to download asset ${host_url}`)
  }
  const fileBuffer = await file.arrayBuffer()
  let release: Release | undefined
  if (plugin.download_type === DownloadType.Dll) {
    release = createReleaseFromDll(plugin, fileBuffer, id, host_url)
  } else {
    release = await createReleaseFromArchive(plugin, fileBuffer, id, host_url)
  }

  if (release !== undefined) {
    addAddonName(plugin, release.name)
  }

  return release
}
