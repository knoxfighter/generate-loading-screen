import * as core from '@actions/core'
import { Plugin } from './plugin'
import { updateFromGithub } from './github'
import { updateStandalone } from './standalone'
import * as fs from 'node:fs'
import * as toml from 'toml'
import path from 'node:path'

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
  if ('github' in plugin.host) {
    await updateFromGithub(plugin, plugin.host.github)
  } else if ('standalone' in plugin.host) {
    await updateStandalone(plugin, plugin.host.standalone)
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const plugins: Plugin[] = []

    // tomls are in the working dir
    const githubWorkspace = process.env['GITHUB_WORKSPACE']
    if (!githubWorkspace) {
      throw new Error('GitHub workspace not set')
    }
    const addonsPath = path.join(githubWorkspace, 'addons')
    const dir = fs.readdirSync(addonsPath)
    for (const addonToml of dir) {
      const addonPath = path.join(addonsPath, addonToml)
      const tomlFile = fs.readFileSync(addonPath)
      const config: Plugin = toml.parse(tomlFile.toString())
      plugins.push(config)
    }

    // get manifest
    let manifestPath = core.getInput('manifest_path')
    if (manifestPath === '' || !fs.existsSync(manifestPath)) {
      // token not set, we generate a new manifest
    } else {
      // merge manifest with tomls
      const manifestPlugins: Plugin[] = JSON.parse(
        fs.readFileSync(manifestPath, 'utf8')
      )

      for (const manifestPlugin of manifestPlugins) {
        const found = plugins.find(
          value => value.package.id === manifestPlugin.package.id
        )
        if (!found) {
          core.warning(
            `Plugin ${manifestPlugin.package.id} was removed from manifest!`
          )
          continue
        }

        found.release = manifestPlugin.release
        found.prerelease = manifestPlugin.prerelease
        found.addon_names = manifestPlugin.addon_names
      }
    }

    for (const plugin of plugins) {
      try {
        await update(plugin)
      } catch (error) {
        // @ts-ignore
        const message = `Plugin ${plugin.package.name} failed to update: ${error.message}`
        core.error(message)
        console.log(message)
      }
    }

    if (manifestPath === '') {
      console.log(JSON.stringify(plugins, null, 2))
    } else {
      fs.writeFileSync(manifestPath, JSON.stringify(plugins))
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    // @ts-expect-error
    console.log(error.message)
    // @ts-expect-error
    core.setFailed(error.message)
  }
}
