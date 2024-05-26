import * as core from '@actions/core'

enum HostType {
  Github = 'github',
  Standalone = 'standalone'
}

enum DownloadType {
  Archive = 'archive',
  Dll = 'dll'
}

enum InstallMode {
  Binary = 'binary',
  Arc = 'arc'
}

type Plugin = {
  name: string
  description: string
  tooltip: string
  website: string
  developer: string

  host_type: HostType
  host_url: string
  version_url?: string

  download_type: DownloadType
  install_mode: InstallMode
  dependencies?: string[]
  optional_dependencies?: string[]
  conflicts?: string[]
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // download json
    let response = await fetch(
      'https://knoxfighter.github.io/addon-repo/manifest.json'
    )
    if (!response.ok) {
      core.setFailed(response.statusText)
      return
    }

    let responseJson = await response.json()
    let data: Plugin[] = JSON.parse(responseJson)

    console.log(data)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
