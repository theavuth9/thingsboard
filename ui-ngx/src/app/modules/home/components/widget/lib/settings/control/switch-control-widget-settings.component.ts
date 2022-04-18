///
/// Copyright © 2016-2022 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import { Component } from '@angular/core';
import { WidgetSettings, WidgetSettingsComponent } from '@shared/models/widget.models';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { switchRpcDefaultSettings } from '@home/components/widget/lib/settings/control/switch-rpc-settings.component';
import { deepClone } from '@core/utils';

@Component({
  selector: 'tb-switch-control-widget-settings',
  templateUrl: './switch-control-widget-settings.component.html',
  styleUrls: ['./../widget-settings.scss']
})
export class SwitchControlWidgetSettingsComponent extends WidgetSettingsComponent {

  switchControlWidgetSettingsForm: FormGroup;

  constructor(protected store: Store<AppState>,
              private fb: FormBuilder) {
    super(store);
  }

  get targetDeviceAliasId(): string {
    const aliasIds = this.widget.config.targetDeviceAliasIds;
    if (aliasIds && aliasIds.length) {
      return aliasIds[0];
    }
    return null;
  }

  protected settingsForm(): FormGroup {
    return this.switchControlWidgetSettingsForm;
  }

  protected defaultSettings(): WidgetSettings {
    return {
      title: '',
      showOnOffLabels: true,
      ...switchRpcDefaultSettings()
    };
  }

  protected onSettingsSet(settings: WidgetSettings) {
    this.switchControlWidgetSettingsForm = this.fb.group({
      title: [settings.title, []],
      showOnOffLabels: [settings.showOnOffLabels, []],
      switchRpcSettings: [settings.switchRpcSettings, []]
    });
  }

  protected prepareInputSettings(settings: WidgetSettings): WidgetSettings {
    const switchRpcSettings = deepClone(settings, ['title', 'showOnOffLabels']);
    return {
      title: settings.title,
      showOnOffLabels: settings.showOnOffLabels,
      switchRpcSettings
    };
  }

  protected prepareOutputSettings(settings: any): WidgetSettings {
    return {
      title: settings.title,
      showOnOffLabels: settings.showOnOffLabels,
      ...settings.switchRpcSettings
    };
  }
}
