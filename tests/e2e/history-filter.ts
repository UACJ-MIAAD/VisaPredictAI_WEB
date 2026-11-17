import type {Locator} from "@playwright/test";

export async function setHistoryStart(root:Locator,value:string,en=false){
  await root.getByRole("combobox",{name:en?"From year":"Desde el año",exact:true}).selectOption(value.slice(0,4));
  if(value)await root.getByRole("combobox",{name:en?"From month":"Desde el mes",exact:true}).selectOption(value.slice(5));
}
