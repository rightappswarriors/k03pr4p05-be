import { core } from "nexus";

declare global {
  interface NexusGenCustomOutputMethods<TypeName extends string> {
    dateTime<FieldName extends string>(
      fieldName: FieldName,
      opts?: core.CommonOutputFieldConfig<TypeName, FieldName>
    ): void;
  }
}
