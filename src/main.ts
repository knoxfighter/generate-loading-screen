import * as core from '@actions/core'
import { HostType, Plugin } from './plugin'
import { updateFromGithub } from './github'
import { updateStandalone } from './standalone'

export function addAddonName(plugin: Plugin, name: string): void {
  if (plugin.addon_names === undefined) {
    plugin.addon_names = [name]
  } else {
    if (!plugin.addon_names.includes(name)) {
      plugin.addon_names = plugin.addon_names.concat(name)
    }
  }
}

async function update(plugin: Plugin): Promise<void> {
  switch (plugin.host_type) {
    case HostType.Github:
      await updateFromGithub(plugin)
      break
    case HostType.Standalone:
      await updateStandalone(plugin)
      break
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // exec("pwd", (error, stdout, stderr) => {
    // 	if (error) {
    // 		throw error
    // 	}
    // 	console.log(stdout)
    // 	console.log(stderr)
    // })

    // download manifest
    const manifestRes = await fetch(
      'https://knoxfighter.github.io/addon-repo/manifest.json'
    )
    if (!manifestRes.ok) {
      core.setFailed(manifestRes.statusText)
      return
    }

    // tomls are in the working dir
    // const dir = fs.readdirSync("./addons")
    // for (let addonToml of dir) {
    // 	const tomlFile = fs.readFileSync(addonToml)
    // 	const config = toml.parse(tomlFile.toString())
    //
    // }

    const plugins: Plugin[] = await manifestRes.json()
    for (const plugin of plugins) {
      try {
        await update(plugin)
      } catch (error) {
        if (error instanceof Error) {
          core.error(`Plugin ${plugin.name} failed to update: ${error.message}`)
        } else {
          core.error(`Plugin ${plugin.name} failed to update`)
        }
      }
    }

    console.log(JSON.stringify(plugins, null, 2))
    // console.log(plugins)
  } catch (error) {
    // Fail the workflow run if an error occurs
    // @ts-expect-error
    console.log(error.message)
    // @ts-expect-error
    core.setFailed(error.message)
  }
}
