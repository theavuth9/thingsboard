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

import { Component, ElementRef, forwardRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  Validator,
  Validators
} from '@angular/forms';
import { PageComponent } from '@shared/components/page.component';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { TranslateService } from '@ngx-translate/core';
import { DataKeyType } from '@shared/models/telemetry/telemetry.models';
import { WidgetService } from '@core/http/widget.service';
import { Observable, of } from 'rxjs';
import { IAliasController } from '@core/api/widget-api.models';
import { catchError, map, mergeMap, publishReplay, refCount, tap } from 'rxjs/operators';
import { DataKey } from '@shared/models/widget.models';
import { EntityService } from '@core/http/entity.service';

export declare type RpcRetrieveValueMethod = 'none' | 'rpc' | 'attribute' | 'timeseries';

export interface SwitchRpcSettings {
  initialValue: boolean;
  retrieveValueMethod: RpcRetrieveValueMethod;
  valueKey: string;
  getValueMethod: string;
  setValueMethod: string;
  parseValueFunction: string;
  convertValueFunction: string;
  requestTimeout: number;
  requestPersistent: boolean;
  persistentPollingInterval: number;
}

export function switchRpcDefaultSettings(): SwitchRpcSettings {
  return {
    initialValue: false,
    retrieveValueMethod: 'rpc',
    valueKey: 'value',
    getValueMethod: 'getValue',
    parseValueFunction: 'return data ? true : false;',
    setValueMethod: 'setValue',
    convertValueFunction: 'return value;',
    requestTimeout: 500,
    requestPersistent: false,
    persistentPollingInterval: 5000
  };
}

@Component({
  selector: 'tb-switch-rpc-settings',
  templateUrl: './switch-rpc-settings.component.html',
  styleUrls: ['./../widget-settings.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SwitchRpcSettingsComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SwitchRpcSettingsComponent),
      multi: true
    }
  ]
})
export class SwitchRpcSettingsComponent extends PageComponent implements OnInit, ControlValueAccessor, Validator, OnChanges {

  @ViewChild('keyInput') keyInput: ElementRef;

  @Input()
  disabled: boolean;

  @Input()
  aliasController: IAliasController;

  @Input()
  targetDeviceAliasId: string;

  functionScopeVariables = this.widgetService.getWidgetScopeVariables();

  private modelValue: SwitchRpcSettings;

  private propagateChange = null;

  public switchRpcSettingsFormGroup: FormGroup;

  filteredKeys: Observable<Array<string>>;
  keySearchText = '';

  private latestKeySearchResult: Array<string> = null;
  private keysFetchObservable$: Observable<Array<string>> = null;

  constructor(protected store: Store<AppState>,
              private translate: TranslateService,
              private widgetService: WidgetService,
              private entityService: EntityService,
              private fb: FormBuilder) {
    super(store);
  }

  ngOnInit(): void {
    this.switchRpcSettingsFormGroup = this.fb.group({

      // Value settings

      initialValue: [false, []],

      // --> Retrieve value settings

      retrieveValueMethod: ['rpc', []],
      valueKey: ['value', [Validators.required]],
      getValueMethod: ['getValue', [Validators.required]],
      parseValueFunction: ['return data ? true : false;', []],

      // --> Update value settings

      setValueMethod: ['setValue', [Validators.required]],
      convertValueFunction: ['return value;', []],

      // RPC settings

      requestTimeout: [500, [Validators.min(0)]],

      // Persistent RPC settings

      requestPersistent: [false, []],
      persistentPollingInterval: [5000, [Validators.min(1000)]],
    });
    this.switchRpcSettingsFormGroup.get('retrieveValueMethod').valueChanges.subscribe(() => {
      this.clearKeysCache();
      this.updateValidators(true);
    });
    this.switchRpcSettingsFormGroup.get('requestPersistent').valueChanges.subscribe(() => {
      this.updateValidators(true);
    });
    this.switchRpcSettingsFormGroup.valueChanges.subscribe(() => {
      this.updateModel();
    });
    this.updateValidators(false);

    this.filteredKeys = this.switchRpcSettingsFormGroup.get('valueKey').valueChanges
      .pipe(
        map(value => value ? value : ''),
        mergeMap(name => this.fetchKeys(name) )
      );
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propName of Object.keys(changes)) {
      const change = changes[propName];
      if (!change.firstChange && change.currentValue !== change.previousValue) {
        if (propName === 'targetDeviceAliasId') {
          this.clearKeysCache();
        }
      }
    }
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.switchRpcSettingsFormGroup.disable({emitEvent: false});
    } else {
      this.switchRpcSettingsFormGroup.enable({emitEvent: false});
    }
  }

  writeValue(value: SwitchRpcSettings): void {
    this.modelValue = value;
    this.switchRpcSettingsFormGroup.patchValue(
      value, {emitEvent: false}
    );
    this.updateValidators(false);
  }

  clearKey() {
    this.switchRpcSettingsFormGroup.get('valueKey').patchValue(null, {emitEvent: true});
    setTimeout(() => {
      this.keyInput.nativeElement.blur();
      this.keyInput.nativeElement.focus();
    }, 0);
  }

  public validate(c: FormControl) {
    return this.switchRpcSettingsFormGroup.valid ? null : {
      switchRpcSettings: {
        valid: false,
      },
    };
  }

  private updateModel() {
    const value: SwitchRpcSettings = this.switchRpcSettingsFormGroup.value;
    this.modelValue = value;
    this.propagateChange(this.modelValue);
  }

  private updateValidators(emitEvent?: boolean): void {
    const retrieveValueMethod: RpcRetrieveValueMethod = this.switchRpcSettingsFormGroup.get('retrieveValueMethod').value;
    const requestPersistent: boolean = this.switchRpcSettingsFormGroup.get('requestPersistent').value;
    if (retrieveValueMethod === 'none') {
      this.switchRpcSettingsFormGroup.get('valueKey').disable({emitEvent});
      this.switchRpcSettingsFormGroup.get('getValueMethod').disable({emitEvent});
      this.switchRpcSettingsFormGroup.get('parseValueFunction').disable({emitEvent});
    } else if (retrieveValueMethod === 'rpc') {
      this.switchRpcSettingsFormGroup.get('valueKey').disable({emitEvent});
      this.switchRpcSettingsFormGroup.get('getValueMethod').enable({emitEvent});
      this.switchRpcSettingsFormGroup.get('parseValueFunction').enable({emitEvent});
    } else {
      this.switchRpcSettingsFormGroup.get('valueKey').enable({emitEvent});
      this.switchRpcSettingsFormGroup.get('getValueMethod').disable({emitEvent});
      this.switchRpcSettingsFormGroup.get('parseValueFunction').enable({emitEvent});
    }
    if (requestPersistent) {
      this.switchRpcSettingsFormGroup.get('persistentPollingInterval').enable({emitEvent});
    } else {
      this.switchRpcSettingsFormGroup.get('persistentPollingInterval').disable({emitEvent});
    }
    this.switchRpcSettingsFormGroup.get('valueKey').updateValueAndValidity({emitEvent: false});
    this.switchRpcSettingsFormGroup.get('getValueMethod').updateValueAndValidity({emitEvent: false});
    this.switchRpcSettingsFormGroup.get('parseValueFunction').updateValueAndValidity({emitEvent: false});
    this.switchRpcSettingsFormGroup.get('persistentPollingInterval').updateValueAndValidity({emitEvent: false});
  }

  private clearKeysCache(): void {
    this.latestKeySearchResult = null;
    this.keysFetchObservable$ = null;
  }

  private fetchKeys(searchText?: string): Observable<Array<string>> {
    if (this.keySearchText !== searchText || this.latestKeySearchResult === null) {
      this.keySearchText = searchText;
      const dataKeyFilter = this.createKeyFilter(this.keySearchText);
      return this.getKeys().pipe(
        map(name => name.filter(dataKeyFilter)),
        tap(res => this.latestKeySearchResult = res)
      );
    }
    return of(this.latestKeySearchResult);
  }

  private getKeys() {
    if (this.keysFetchObservable$ === null) {
      let fetchObservable: Observable<Array<DataKey>>;
      if (this.targetDeviceAliasId) {
        const retrieveValueMethod: RpcRetrieveValueMethod = this.switchRpcSettingsFormGroup.get('retrieveValueMethod').value;
        const dataKeyTypes = retrieveValueMethod === 'attribute' ? [DataKeyType.attribute] : [DataKeyType.timeseries];
        fetchObservable = this.fetchEntityKeys(this.targetDeviceAliasId, dataKeyTypes);
      } else {
        fetchObservable = of([]);
      }
      this.keysFetchObservable$ = fetchObservable.pipe(
        map((dataKeys) => dataKeys.map((dataKey) => dataKey.name)),
        publishReplay(1),
        refCount()
      );
    }
    return this.keysFetchObservable$;
  }

  private fetchEntityKeys(entityAliasId: string, dataKeyTypes: Array<DataKeyType>): Observable<Array<DataKey>> {
    return this.aliasController.getAliasInfo(entityAliasId).pipe(
      mergeMap((aliasInfo) => {
        return this.entityService.getEntityKeysByEntityFilter(
          aliasInfo.entityFilter,
          dataKeyTypes,
          {ignoreLoading: true, ignoreErrors: true}
        ).pipe(
          catchError(() => of([]))
        );
      }),
      catchError(() => of([] as Array<DataKey>))
    );
  }

  private createKeyFilter(query: string): (key: string) => boolean {
    const lowercaseQuery = query.toLowerCase();
    return key => key.toLowerCase().startsWith(lowercaseQuery);
  }
}
